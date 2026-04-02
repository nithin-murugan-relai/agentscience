import assert from "node:assert/strict";
import test from "node:test";

import { UserFacingError } from "@/lib/errors";
import { computeFeedScore } from "@/lib/sidekick/scoring";
import {
  type SidekickAgentProfile,
  type SidekickRepository,
} from "@/lib/sidekick/repository";
import { SidekickService } from "@/lib/sidekick/service";
import type {
  SidekickAdversarialReviewRecord,
  SidekickAgentRecord,
  SidekickEngagementRecord,
  SidekickPaperRecord,
  SidekickPaperStatus,
  SidekickReferenceRecord,
  SidekickReputationEventRecord,
  SidekickReputationEventType,
  SidekickReviewTrigger,
} from "@/lib/sidekick/types";
import type { SidekickReferenceInput } from "@/lib/sidekick/validation";

class InMemorySidekickRepository implements SidekickRepository {
  agents = new Map<string, SidekickAgentRecord>();
  papers = new Map<string, SidekickPaperRecord>();
  references = new Map<string, SidekickReferenceRecord>();
  engagements = new Map<string, SidekickEngagementRecord>();
  reviews = new Map<string, SidekickAdversarialReviewRecord>();
  reputationEvents = new Map<string, SidekickReputationEventRecord>();
  signals = new Map<string, Array<{ delta: number; reason: string; createdAt: Date }>>();
  private sequence = 1;

  createId(prefix: string) {
    const value = `${prefix}-${this.sequence}`;
    this.sequence += 1;
    return value;
  }

  seedAgent(input: Partial<SidekickAgentRecord> & Pick<SidekickAgentRecord, "id" | "name">) {
    const agent: SidekickAgentRecord = {
      id: input.id,
      name: input.name,
      reputationScore: input.reputationScore ?? 0,
      totalPapers: input.totalPapers ?? 0,
      createdAt: input.createdAt ?? new Date("2026-04-01T00:00:00.000Z"),
    };
    this.agents.set(agent.id, agent);
    return agent;
  }

  seedPaper(
    input: Partial<SidekickPaperRecord> &
      Pick<
        SidekickPaperRecord,
        | "id"
        | "agentId"
        | "title"
        | "fullContent"
        | "claim1"
        | "claim2"
        | "claim3"
        | "methodology"
        | "noveltyStatement"
      > & { references?: SidekickReferenceInput[] }
  ) {
    const paper: SidekickPaperRecord = {
      id: input.id,
      agentId: input.agentId,
      title: input.title,
      fullContent: input.fullContent,
      claim1: input.claim1,
      claim2: input.claim2,
      claim3: input.claim3,
      methodology: input.methodology,
      noveltyStatement: input.noveltyStatement,
      fieldTags: input.fieldTags ?? [],
      refValidityRate: input.refValidityRate ?? 1,
      specificityScore: input.specificityScore ?? 4,
      engagementSignal: input.engagementSignal ?? 1,
      feedScore: input.feedScore ?? 0,
      status: input.status ?? "ACTIVE",
      adversarialSurvival: input.adversarialSurvival ?? null,
      createdAt: input.createdAt ?? new Date("2026-04-01T00:00:00.000Z"),
    };
    this.papers.set(paper.id, paper);
    for (const reference of input.references ?? []) {
      const id = this.createId("ref");
      this.references.set(id, {
        id,
        paperId: paper.id,
        title: reference.title,
        authors: reference.authors,
        doi: reference.doi || null,
        year: reference.year,
        validated: true,
      });
    }
    return paper;
  }

  async getAgent(agentId: string) {
    return this.agents.get(agentId) ?? null;
  }

  async createPaper(input: {
    agentId: string;
    title: string;
    fullContent: string;
    claim1: string;
    claim2: string;
    claim3: string;
    methodology: string;
    noveltyStatement: string;
    fieldTags: string[];
    engagementSignal: number;
    references: SidekickReferenceInput[];
  }) {
    const agent = this.agents.get(input.agentId);
    if (!agent) {
      throw new Error("Agent missing");
    }

    agent.totalPapers += 1;
    const paper = this.seedPaper({
      id: this.createId("paper"),
      agentId: input.agentId,
      title: input.title,
      fullContent: input.fullContent,
      claim1: input.claim1,
      claim2: input.claim2,
      claim3: input.claim3,
      methodology: input.methodology,
      noveltyStatement: input.noveltyStatement,
      fieldTags: input.fieldTags,
      engagementSignal: input.engagementSignal,
      status: "BURIED",
      refValidityRate: 0,
      specificityScore: 0,
      references: input.references,
    });

    return this.requirePaperBundle(paper.id);
  }

  async updatePaperIntegrity(input: {
    paperId: string;
    refValidityRate: number;
    specificityScore: number;
    status: SidekickPaperStatus;
    validatedReferences: boolean[];
    feedScore: number;
  }) {
    const paper = this.papers.get(input.paperId);
    if (!paper) {
      throw new Error("Paper missing");
    }

    paper.refValidityRate = input.refValidityRate;
    paper.specificityScore = input.specificityScore;
    paper.status = input.status;
    paper.feedScore = input.feedScore;
    this.referencesForPaper(input.paperId).forEach((reference, index) => {
      reference.validated = input.validatedReferences[index] ?? false;
    });
    return this.requirePaperBundle(input.paperId);
  }

  async getPaper(paperId: string) {
    if (!this.papers.has(paperId)) {
      return null;
    }
    return this.requirePaperBundle(paperId);
  }

  async listFeedPapers(input: { skip: number; take: number }) {
    return [...this.papers.values()]
      .filter((paper) => paper.status === "ACTIVE")
      .sort((left, right) => right.feedScore - left.feedScore || right.createdAt.getTime() - left.createdAt.getTime())
      .slice(input.skip, input.skip + input.take)
      .map((paper) => this.requirePaperBundle(paper.id));
  }

  async listActivePapers() {
    return [...this.papers.values()]
      .filter((paper) => paper.status === "ACTIVE" || paper.status === "FLAGGED")
      .map((paper) => this.requirePaperBundle(paper.id));
  }

  async updatePaperFeedScore(paperId: string, feedScore: number) {
    const paper = this.papers.get(paperId);
    if (paper) {
      paper.feedScore = feedScore;
    }
  }

  async updatePaperReviewOutcome(input: {
    paperId: string;
    adversarialSurvival: number;
    status: SidekickPaperStatus;
    feedScore: number;
  }) {
    const paper = this.papers.get(input.paperId);
    if (!paper) {
      throw new Error("Paper missing");
    }

    paper.adversarialSurvival = input.adversarialSurvival;
    paper.status = input.status;
    paper.feedScore = input.feedScore;
  }

  async incrementPaperSignal(input: { paperId: string; delta: number; reason: string }) {
    const paper = this.papers.get(input.paperId);
    if (!paper) {
      throw new Error("Paper missing");
    }

    paper.engagementSignal += input.delta;
    const list = this.signals.get(input.paperId) ?? [];
    list.push({
      delta: input.delta,
      reason: input.reason,
      createdAt: new Date("2026-04-02T06:00:00.000Z"),
    });
    this.signals.set(input.paperId, list);
    return paper;
  }

  async createEngagement(input: {
    paperId: string;
    agentId: string;
    type: SidekickEngagementRecord["type"];
    targetClaim?: number | null;
    buildingPaperId?: string | null;
    result?: SidekickEngagementRecord["result"];
    content: string;
    substantiveness: number;
    weight: number;
  }) {
    const engagement: SidekickEngagementRecord = {
      id: this.createId("engagement"),
      paperId: input.paperId,
      agentId: input.agentId,
      type: input.type,
      targetClaim: input.targetClaim ?? null,
      buildingPaperId: input.buildingPaperId ?? null,
      result: input.result ?? null,
      content: input.content,
      substantiveness: input.substantiveness,
      weight: input.weight,
      createdAt: new Date("2026-04-02T06:00:00.000Z"),
    };
    this.engagements.set(engagement.id, engagement);
    return engagement;
  }

  async createAdversarialReview(input: {
    paperId: string;
    survivalScore: number;
    findings: Record<string, unknown>;
    triggerReason: SidekickReviewTrigger;
  }) {
    const review: SidekickAdversarialReviewRecord = {
      id: this.createId("review"),
      paperId: input.paperId,
      survivalScore: input.survivalScore,
      findings: input.findings,
      triggerReason: input.triggerReason,
      createdAt: new Date("2026-04-02T06:05:00.000Z"),
    };
    this.reviews.set(review.id, review);
    return review;
  }

  async createReputationEvents(
    events: Array<{
      agentId: string;
      paperId?: string | null;
      engagementId?: string | null;
      reviewId?: string | null;
      type: SidekickReputationEventType;
      points: number;
      metadata?: Record<string, unknown> | null;
    }>
  ) {
    for (const event of events) {
      const record: SidekickReputationEventRecord = {
        id: this.createId("rep"),
        agentId: event.agentId,
        paperId: event.paperId ?? null,
        engagementId: event.engagementId ?? null,
        reviewId: event.reviewId ?? null,
        type: event.type,
        points: event.points,
        metadata: event.metadata ?? null,
        createdAt: new Date("2026-04-02T06:10:00.000Z"),
      };
      this.reputationEvents.set(record.id, record);
    }
  }

  async listReputationEvents(agentId: string) {
    return [...this.reputationEvents.values()]
      .filter((event) => event.agentId === agentId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  async updateAgentReputation(agentId: string, reputationScore: number) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.reputationScore = reputationScore;
    }
  }

  async listSignalsSince(paperId: string, since: Date) {
    return (this.signals.get(paperId) ?? [])
      .filter((entry) => entry.createdAt >= since)
      .reduce((sum, entry) => sum + entry.delta, 0);
  }

  async getAgentProfile(agentId: string): Promise<SidekickAgentProfile | null> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return null;
    }

    return {
      agent,
      papers: [...this.papers.values()].filter((paper) => paper.agentId === agentId),
      engagements: [...this.engagements.values()].filter((engagement) => engagement.agentId === agentId),
      reputationEvents: [...this.reputationEvents.values()].filter((event) => event.agentId === agentId),
    };
  }

  private requirePaperBundle(paperId: string) {
    const paper = this.papers.get(paperId);
    if (!paper) {
      throw new Error(`Missing paper ${paperId}`);
    }

    const agent = this.agents.get(paper.agentId);
    if (!agent) {
      throw new Error(`Missing agent ${paper.agentId}`);
    }

    const review =
      [...this.reviews.values()]
        .filter((entry) => entry.paperId === paperId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;

    return {
      paper,
      agent,
      references: this.referencesForPaper(paperId),
      engagements: [...this.engagements.values()].filter((engagement) => engagement.paperId === paperId),
      adversarialReview: review,
    };
  }

  private referencesForPaper(paperId: string) {
    return [...this.references.values()].filter((reference) => reference.paperId === paperId);
  }
}

function createServiceHarness() {
  const repository = new InMemorySidekickRepository();
  const service = new SidekickService({
    repository,
    referenceValidator: async (references) => {
      const validated = references.map(
        (reference) =>
          !/(fabricated|fake|imaginary|made up|invented)/i.test(
            `${reference.title} ${reference.authors} ${reference.doi ?? ""}`
          )
      );
      return {
        validated,
        rate: validated.filter(Boolean).length / references.length,
      };
    },
    claimSpecificityScorer: async ({ claims }) => {
      const scores = claims.map((claim) => {
        if (/(novel approach|novel method|improve performance|advance the state)/i.test(claim)) {
          return 1;
        }
        if (/\d/.test(claim) || /(dataset|benchmark|cohort|hours|percent|%|error|auc)/i.test(claim)) {
          return 4;
        }
        return 3;
      }) as [number, number, number];
      return {
        scores,
        average: scores.reduce((sum, value) => sum + value, 0) / scores.length,
      };
    },
    substantivenessScorer: async (prompt) => {
      if (/(vague challenge|hand-wavy|unclear concern)/i.test(prompt)) {
        return { score: 2, reason: "Too vague to count." };
      }
      if (/(result: contradicted|contradicted|detailed|baseline|evidence|protocol|dataset|hours|%)/i.test(prompt)) {
        return { score: 4, reason: "Detailed and substantive." };
      }
      return { score: 3, reason: "Substantive enough." };
    },
    adversarialReviewer: async ({ paper }) => {
      const fragile = /(slop|mediocre|fragile|gaming)/i.test(paper.title);
      const robust = /(quality|robust|useful|survives)/i.test(paper.title);
      const survival = fragile ? 0.2 : robust ? 0.82 : 0.55;
      return {
        claim_verification: { score: survival, findings: "Claim check complete." },
        reference_integrity: { score: Math.max(0.2, paper.refValidityRate), findings: "Reference check complete." },
        methodological_coherence: { score: survival, findings: "Method check complete." },
        hallucination_flags: { score: survival, findings: "Hallucination check complete." },
        survival_score: survival,
        summary: "Adversarial review summary.",
      };
    },
    referenceAbstractFetcher: async (references) =>
      references.slice(0, 3).map((reference) => `Title: ${reference.title}\nAbstract: Sample abstract.`),
  });

  return { repository, service };
}

function createReference(title: string) {
  return {
    title,
    authors: "Researcher A; Researcher B",
    year: 2024,
    doi: `10.5555/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  };
}

function createSubmission(agentId: string, overrides: Partial<Parameters<SidekickService["submitPaper"]>[0]> = {}) {
  return {
    agent_id: agentId,
    title: overrides.title ?? "Quality paper on adaptive sequencing under outbreak pressure",
    full_content:
      overrides.full_content ??
      "# Methods\nWe compared three protocols across 120 samples.\n# Results\nWe reduced decision time from 18 hours to 8 hours with 3% error drift.",
    claims:
      overrides.claims ??
      [
        "We reduce outbreak triage decision time from 18 hours to 8 hours across 120 samples.",
        "We improve recall on the ICU outbreak cohort from 0.71 to 0.83 versus FIFO triage.",
        "We keep consensus error below 3% while processing 30% fewer sequencing reads.",
      ],
    methodology:
      overrides.methodology ??
      "We evaluated the policy against FIFO and stratified baselines on 120 retrospective and prospective samples.",
    novelty_statement:
      overrides.novelty_statement ??
      "We advance outbreak triage beyond FIFO by using uncertainty-aware sequencing allocation.",
    field_tags: overrides.field_tags ?? ["sequencing", "outbreaks"],
    references:
      overrides.references ??
      [
        createReference("Adaptive sequencing benchmark"),
        createReference("Outbreak response cohort"),
        createReference("Prospective validation study"),
        createReference("Clinical queueing baseline"),
      ],
  };
}

test("VERIFY Layer 1: paper with 30% fabricated references is buried", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });

  const paper = await service.submitPaper(
    createSubmission("agent-a", {
      references: [
        createReference("Valid one"),
        createReference("Valid two"),
        { ...createReference("Fabricated citation one"), title: "Fabricated citation one" },
        { ...createReference("Imaginary trial"), title: "Imaginary trial" },
      ],
    })
  );

  assert.equal(paper.paper.status, "BURIED");
  assert.equal(paper.paper.refValidityRate, 0.5);
});

test("VERIFY Layer 1: paper with vague claims is buried", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });

  const paper = await service.submitPaper(
    createSubmission("agent-a", {
      claims: [
        "We propose a novel approach to science.",
        "We improve performance on many tasks.",
        "We advance the state of the art with a novel method.",
      ],
    })
  );

  assert.equal(paper.paper.status, "BURIED");
  assert.ok(paper.paper.specificityScore < 2.5);
});

test("VERIFY Layer 1: paper with valid references and specific claims becomes active", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });

  const paper = await service.submitPaper(createSubmission("agent-a"));

  assert.equal(paper.paper.status, "ACTIVE");
  assert.equal(paper.paper.refValidityRate, 1);
  assert.ok(paper.paper.specificityScore >= 2.5);
});

test("VERIFY Layer 2: feed returns papers in correct score order", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedPaper({
    id: "p1",
    agentId: "agent-a",
    title: "Paper one",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 8,
    status: "ACTIVE",
    createdAt: new Date("2026-04-02T05:00:00.000Z"),
  });
  repository.seedPaper({
    id: "p2",
    agentId: "agent-a",
    title: "Paper two",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 3,
    status: "ACTIVE",
    createdAt: new Date("2026-04-02T05:30:00.000Z"),
  });

  await service.recomputeFeed(new Date("2026-04-02T06:00:00.000Z"));
  const feed = await service.listFeed(1, 10);
  assert.deepEqual(feed.map((entry) => entry.paper.id), ["p1", "p2"]);
});

test("VERIFY Layer 2: older papers decay below newer papers with equal engagement", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedPaper({
    id: "older",
    agentId: "agent-a",
    title: "Older paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 5,
    status: "ACTIVE",
    createdAt: new Date("2026-04-01T06:00:00.000Z"),
  });
  repository.seedPaper({
    id: "newer",
    agentId: "agent-a",
    title: "Newer paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 5,
    status: "ACTIVE",
    createdAt: new Date("2026-04-02T05:00:00.000Z"),
  });

  await service.recomputeFeed(new Date("2026-04-02T06:00:00.000Z"));
  const feed = await service.listFeed(1, 10);
  assert.deepEqual(feed.map((entry) => entry.paper.id), ["newer", "older"]);
});

test("VERIFY Layer 3: build from Agent B on Agent A's paper increases engagement by 5.0", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedAgent({ id: "agent-b", name: "Agent B" });
  repository.seedPaper({
    id: "target",
    agentId: "agent-a",
    title: "Target quality paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 1,
    status: "ACTIVE",
  });
  repository.seedPaper({
    id: "builder",
    agentId: "agent-b",
    title: "Builder paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Builder claim 1 on 100 samples.",
    claim2: "Builder claim 2 on benchmark X.",
    claim3: "Builder claim 3 with 12% improvement.",
    methodology: "Detailed baseline and evidence for a substantive citation.",
    noveltyStatement: "Novelty",
    engagementSignal: 1,
    status: "ACTIVE",
  });

  await service.registerBuild("target", { agent_id: "agent-b", building_paper_id: "builder" });

  assert.equal(repository.papers.get("target")?.engagementSignal, 6);
});

test("VERIFY Layer 3: self-engagement is rejected", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedPaper({
    id: "target",
    agentId: "agent-a",
    title: "Target quality paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    status: "ACTIVE",
  });

  await assert.rejects(
    service.registerChallenge("target", {
      agent_id: "agent-a",
      target_claim: 1,
      objection: "Specific objection with evidence and baseline details.",
      supporting_evidence: "Detailed evidence with a protocol and benchmark.",
    }),
    (error: unknown) =>
      error instanceof UserFacingError &&
      error.message === "Agents cannot engage with their own papers."
  );
});

test("VERIFY Layer 3: duplicate engagement is rejected", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedAgent({ id: "agent-b", name: "Agent B" });
  repository.seedPaper({
    id: "target",
    agentId: "agent-a",
    title: "Target quality paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    status: "ACTIVE",
  });

  await service.registerChallenge("target", {
    agent_id: "agent-b",
    target_claim: 1,
    objection: "Specific objection with evidence and baseline details.",
    supporting_evidence: "Detailed evidence with a protocol and benchmark.",
  });

  await assert.rejects(
    service.registerChallenge("target", {
      agent_id: "agent-b",
      target_claim: 1,
      objection: "Specific objection with evidence and baseline details.",
      supporting_evidence: "Detailed evidence with a protocol and benchmark.",
    }),
    (error: unknown) =>
      error instanceof UserFacingError && error.message === "Duplicate engagement."
  );
});

test("VERIFY Layer 3: contradicted reproduction triggers adversarial review", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedAgent({ id: "agent-b", name: "Agent B" });
  repository.seedPaper({
    id: "target",
    agentId: "agent-a",
    title: "Target quality paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    status: "ACTIVE",
  });

  await service.registerReproduction("target", {
    agent_id: "agent-b",
    target_claim: 1,
    methodology_used: "Detailed protocol with baseline and dataset splits.",
    result: "contradicted",
    evidence: "Detailed evidence showing the claimed effect disappears on the held-out cohort.",
  });

  const review = [...repository.reviews.values()][0];
  assert.ok(review);
  assert.equal(review.paperId, "target");
  assert.equal(review.triggerReason, "FAILED_REPRODUCTION");
});

test("VERIFY Layer 3: vague challenge (substantiveness < 3) does not count", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedAgent({ id: "agent-b", name: "Agent B" });
  repository.seedPaper({
    id: "target",
    agentId: "agent-a",
    title: "Target quality paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 1,
    status: "ACTIVE",
  });

  const result = await service.registerChallenge("target", {
    agent_id: "agent-b",
    target_claim: 2,
    objection: "Vague challenge with an unclear concern.",
    supporting_evidence: "Hand-wavy note with no protocol.",
  });

  assert.equal(result.accepted, false);
  assert.equal(repository.papers.get("target")?.engagementSignal, 1);
});

test("VERIFY Layer 4: paper in top 50 triggers review", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedPaper({
    id: "top-paper",
    agentId: "agent-a",
    title: "Quality top paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    feedScore: 5,
    status: "ACTIVE",
  });

  const queued = await service.checkAdversarialTriggers(new Date("2026-04-02T06:00:00.000Z"));

  assert.deepEqual(queued, [{ paperId: "top-paper", reason: "TOP_50" }]);
  const processed = await service.processTriggeredReviews(new Date("2026-04-02T06:00:00.000Z"));
  assert.deepEqual(processed, [
    {
      paperId: "top-paper",
      reason: "TOP_50",
      reviewId: [...repository.reviews.values()][0]?.id,
    },
  ]);
});

test("VERIFY Layer 4: survival_score < 0.4 results in 0.1x multiplier and reputation -10", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedPaper({
    id: "fragile",
    agentId: "agent-a",
    title: "Mediocre fragile gaming paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 10,
    status: "ACTIVE",
    createdAt: new Date("2026-04-02T05:00:00.000Z"),
  });

  const before = computeFeedScore({
    engagementSignal: 10,
    createdAt: new Date("2026-04-02T05:00:00.000Z"),
    now: new Date("2026-04-02T06:00:00.000Z"),
  });
  repository.papers.get("fragile")!.feedScore = before;
  const review = await service.runAdversarialReview(
    "fragile",
    "TOP_50",
    new Date("2026-04-02T06:00:00.000Z")
  );

  assert.ok(review.survivalScore < 0.4);
  const after = repository.papers.get("fragile")!.feedScore;
  assert.ok(Math.abs(after - before * 0.1) < 1e-9);
  assert.equal(repository.agents.get("agent-a")?.reputationScore, -10);
});

test("VERIFY Layer 5: agent with high-quality track record has positive reputation", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });

  await service.submitPaper(createSubmission("agent-a", { title: "Quality robust paper one" }));
  const paperTwo = await service.submitPaper(createSubmission("agent-a", { title: "Quality robust paper two" }));
  await service.runAdversarialReview(paperTwo.paper.id, "TOP_50");

  assert.ok((repository.agents.get("agent-a")?.reputationScore ?? 0) > 0);
});

test("VERIFY Layer 5: agent who spams bad papers has negative reputation", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });

  await service.submitPaper(
    createSubmission("agent-a", {
      title: "Slop paper one",
      references: [
        { ...createReference("Fabricated one"), title: "Fabricated one" },
        { ...createReference("Fabricated two"), title: "Fabricated two" },
        createReference("Valid one"),
      ],
      claims: [
        "We propose a novel approach to science.",
        "We improve performance on many tasks.",
        "We advance the state of the art with a novel method.",
      ],
    })
  );
  await service.submitPaper(
    createSubmission("agent-a", {
      title: "Slop paper two",
      references: [
        { ...createReference("Fabricated three"), title: "Fabricated three" },
        { ...createReference("Fabricated four"), title: "Fabricated four" },
        createReference("Valid two"),
      ],
      claims: [
        "We propose a novel approach to science.",
        "We improve performance on many tasks.",
        "We advance the state of the art with a novel method.",
      ],
    })
  );

  assert.ok((repository.agents.get("agent-a")?.reputationScore ?? 0) < 0);
});

test("INTEGRATION: slop paper with fake references is buried and never appears in feed", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "slopper", name: "Slopper" });
  const paper = await service.submitPaper(
    createSubmission("slopper", {
      title: "Slop paper",
      references: [
        { ...createReference("Fake one"), title: "Fake one" },
        { ...createReference("Fake two"), title: "Fake two" },
        { ...createReference("Fake three"), title: "Fake three" },
        createReference("Valid one"),
      ],
    })
  );

  const feed = await service.listFeed(1, 20);
  assert.equal(paper.paper.status, "BURIED");
  assert.equal(feed.some((entry) => entry.paper.id === paper.paper.id), false);
});

test("INTEGRATION: quality paper enters feed, gets built on, rises, survives adversarial review", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });
  repository.seedAgent({ id: "agent-b", name: "Agent B" });
  const target = await service.submitPaper(createSubmission("agent-a", { title: "Quality survives paper" }));
  const baseline = target.paper.feedScore;
  repository.seedPaper({
    id: "builder",
    agentId: "agent-b",
    title: "Builder paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Builder claim 1 on 100 samples.",
    claim2: "Builder claim 2 on benchmark X.",
    claim3: "Builder claim 3 with 12% improvement.",
    methodology: "Detailed baseline and evidence for a substantive citation.",
    noveltyStatement: "Novelty",
    status: "ACTIVE",
  });

  await service.registerBuild(target.paper.id, {
    agent_id: "agent-b",
    building_paper_id: "builder",
  });
  await service.runAdversarialReview(target.paper.id, "TOP_50");

  const updated = repository.papers.get(target.paper.id)!;
  assert.ok(updated.feedScore > baseline);
  assert.ok((updated.adversarialSurvival ?? 0) >= 0.7);
});

test("INTEGRATION: gaming attempt triggers spike review and paper is demoted", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "target-agent", name: "Target Agent" });
  repository.seedPaper({
    id: "gaming-target",
    agentId: "target-agent",
    title: "Mediocre gaming target paper",
    fullContent: "# Methods\nA\n# Results\nB",
    claim1: "Claim 1 on 100 samples.",
    claim2: "Claim 2 on benchmark X.",
    claim3: "Claim 3 with 12% improvement.",
    methodology: "Method",
    noveltyStatement: "Novelty",
    engagementSignal: 1,
    status: "ACTIVE",
    createdAt: new Date("2026-04-02T05:00:00.000Z"),
  });

  for (let index = 0; index < 5; index += 1) {
    const agentId = `builder-${index}`;
    repository.seedAgent({ id: agentId, name: `Builder ${index}` });
    repository.seedPaper({
      id: `builder-paper-${index}`,
      agentId,
      title: `Builder paper ${index}`,
      fullContent: "# Methods\nA\n# Results\nB",
      claim1: "Builder claim 1 on 100 samples.",
      claim2: "Builder claim 2 on benchmark X.",
      claim3: "Builder claim 3 with 12% improvement.",
      methodology: "Detailed baseline and evidence for a substantive citation.",
      noveltyStatement: "Novelty",
      status: "ACTIVE",
    });
    await service.registerBuild("gaming-target", {
      agent_id: agentId,
      building_paper_id: `builder-paper-${index}`,
    });
  }

  const review = [...repository.reviews.values()][0];
  assert.ok(review);
  assert.ok(
    review.triggerReason === "ENGAGEMENT_SPIKE" ||
      review.triggerReason === "ENGAGEMENT_THRESHOLD"
  );
  const paper = repository.papers.get("gaming-target")!;
  assert.ok((paper.adversarialSurvival ?? 1) < 0.4);
});

test("INTEGRATION: reputation arc declines after good papers then bad ones", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "agent-a", name: "Agent A" });

  const goodPaper = await service.submitPaper(createSubmission("agent-a", { title: "Quality robust paper" }));
  await service.runAdversarialReview(goodPaper.paper.id, "TOP_50");
  const high = repository.agents.get("agent-a")!.reputationScore;

  await service.submitPaper(
    createSubmission("agent-a", {
      title: "Slop paper three",
      references: [
        { ...createReference("Fabricated five"), title: "Fabricated five" },
        { ...createReference("Fabricated six"), title: "Fabricated six" },
        createReference("Valid three"),
      ],
      claims: [
        "We propose a novel approach to science.",
        "We improve performance on many tasks.",
        "We advance the state of the art with a novel method.",
      ],
    })
  );
  const low = repository.agents.get("agent-a")!.reputationScore;

  assert.ok(low < high);
});

test("INTEGRATION: confirmed and contradicted reproductions trigger review and update reputation", async () => {
  const { repository, service } = createServiceHarness();
  repository.seedAgent({ id: "target-agent", name: "Target Agent" });
  repository.seedAgent({ id: "confirm-agent", name: "Confirm Agent" });
  repository.seedAgent({ id: "contradict-agent", name: "Contradict Agent" });
  const paper = await service.submitPaper(createSubmission("target-agent", { title: "Quality paper for reproductions" }));

  await service.registerReproduction(paper.paper.id, {
    agent_id: "confirm-agent",
    target_claim: 1,
    methodology_used: "Detailed protocol and dataset split with baseline comparisons.",
    result: "confirmed",
    evidence: "Detailed evidence showing the effect persists in the held-out cohort.",
  });
  await service.registerReproduction(paper.paper.id, {
    agent_id: "contradict-agent",
    target_claim: 2,
    methodology_used: "Detailed protocol and dataset split with baseline comparisons.",
    result: "contradicted",
    evidence: "Detailed evidence showing the effect disappears in the held-out cohort.",
  });

  assert.ok([...repository.reviews.values()].some((entry) => entry.paperId === paper.paper.id));
  assert.ok((repository.agents.get("target-agent")?.reputationScore ?? 0) > 0);
  assert.ok((repository.agents.get("confirm-agent")?.reputationScore ?? 0) > 0);
  assert.ok((repository.agents.get("contradict-agent")?.reputationScore ?? 0) > 0);
});
