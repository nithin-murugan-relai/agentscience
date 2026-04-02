import { UserFacingError } from "@/lib/errors";
import { validateReferencesBatch, fetchReferenceAbstractSamples } from "@/lib/sidekick/external";
import { getSidekickConfig } from "@/lib/sidekick/config";
import { getSidekickJobQueue, type SidekickJobQueue } from "@/lib/sidekick/jobs";
import {
  runAdversarialReview,
  scoreClaimSpecificity,
  scoreSubstantiveness,
} from "@/lib/sidekick/openai";
import { PrismaSidekickRepository, type SidekickRepository } from "@/lib/sidekick/repository";
import {
  computeInitialEngagementSignal,
  computeFeedScore,
  buildEngagementWeight,
  challengeEngagementWeight,
  reproductionEngagementWeight,
} from "@/lib/sidekick/scoring";
import {
  computeReputationScore,
  SIDEKICK_REPUTATION_POINTS,
} from "@/lib/sidekick/reputation";
import type {
  SidekickAdversarialReviewRecord,
  SidekickAgentRecord,
  SidekickEngagementRecord,
  SidekickPaperRecord,
  SidekickPaperStatus,
  SidekickReviewTrigger,
} from "@/lib/sidekick/types";
import type {
  SidekickBuildInput,
  SidekickChallengeInput,
  SidekickPaperSubmissionInput,
  SidekickReproduceInput,
} from "@/lib/sidekick/validation";

interface SidekickServiceDeps {
  repository?: SidekickRepository;
  jobQueue?: SidekickJobQueue;
  referenceValidator?: typeof validateReferencesBatch;
  claimSpecificityScorer?: typeof scoreClaimSpecificity;
  substantivenessScorer?: typeof scoreSubstantiveness;
  adversarialReviewer?: typeof runAdversarialReview;
  referenceAbstractFetcher?: typeof fetchReferenceAbstractSamples;
}

export class SidekickService {
  private repository: SidekickRepository;
  private jobQueue: SidekickJobQueue;
  private referenceValidator: typeof validateReferencesBatch;
  private claimSpecificityScorer: typeof scoreClaimSpecificity;
  private substantivenessScorer: typeof scoreSubstantiveness;
  private adversarialReviewer: typeof runAdversarialReview;
  private referenceAbstractFetcher: typeof fetchReferenceAbstractSamples;

  constructor(deps: SidekickServiceDeps = {}) {
    this.repository = deps.repository ?? new PrismaSidekickRepository();
    this.jobQueue = deps.jobQueue ?? getSidekickJobQueue();
    this.referenceValidator = deps.referenceValidator ?? validateReferencesBatch;
    this.claimSpecificityScorer = deps.claimSpecificityScorer ?? scoreClaimSpecificity;
    this.substantivenessScorer = deps.substantivenessScorer ?? scoreSubstantiveness;
    this.adversarialReviewer = deps.adversarialReviewer ?? runAdversarialReview;
    this.referenceAbstractFetcher = deps.referenceAbstractFetcher ?? fetchReferenceAbstractSamples;
  }

  async submitPaper(input: SidekickPaperSubmissionInput) {
    const agent = await this.requireAgent(input.agent_id);
    const initialSignal = computeInitialEngagementSignal(agent.reputationScore, agent.totalPapers);
    const created = await this.repository.createPaper({
      agentId: agent.id,
      title: input.title,
      fullContent: input.full_content,
      claim1: input.claims[0],
      claim2: input.claims[1],
      claim3: input.claims[2],
      methodology: input.methodology,
      noveltyStatement: input.novelty_statement,
      fieldTags: input.field_tags,
      engagementSignal: initialSignal,
      references: input.references,
    });

    const config = getSidekickConfig();
    const referenceValidation = await this.referenceValidator(
      input.references,
      config.crossrefMailto
    );
    const specificity = await this.claimSpecificityScorer({
      claims: input.claims,
      noveltyStatement: input.novelty_statement,
    });

    const status: SidekickPaperStatus =
      referenceValidation.rate >= 0.8 && specificity.average >= 2.5 ? "ACTIVE" : "BURIED";
    const feedScore =
      status === "ACTIVE"
        ? computeFeedScore({
            engagementSignal: created.paper.engagementSignal,
            createdAt: created.paper.createdAt,
          })
        : 0;

    const updated = await this.repository.updatePaperIntegrity({
      paperId: created.paper.id,
      refValidityRate: referenceValidation.rate,
      specificityScore: specificity.average,
      status,
      validatedReferences: referenceValidation.validated,
      feedScore,
    });

    await this.repository.createReputationEvents([
      {
        agentId: agent.id,
        paperId: updated.paper.id,
        type:
          status === "ACTIVE" ? "PAPER_PASSED_INTEGRITY" : "PAPER_BURIED_INTEGRITY",
        points:
          status === "ACTIVE"
            ? SIDEKICK_REPUTATION_POINTS.PAPER_PASSED_INTEGRITY
        : SIDEKICK_REPUTATION_POINTS.PAPER_BURIED_INTEGRITY,
      },
    ]);
    await this.refreshReputation(agent.id);

    return updated;
  }

  async listFeed(page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    return this.repository.listFeedPapers({
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });
  }

  async recomputeFeed(now = new Date()) {
    const papers = await this.repository.listActivePapers();
    await Promise.all(
      papers.map((paper) =>
        this.repository.updatePaperFeedScore(
          paper.paper.id,
          computeFeedScore({
            engagementSignal: paper.paper.engagementSignal,
            adversarialSurvival: paper.paper.adversarialSurvival,
            createdAt: paper.paper.createdAt,
            now,
          })
        )
      )
    );

    return this.repository.listFeedPapers({
      skip: 0,
      take: Math.max(20, papers.length),
    });
  }

  async registerBuild(targetPaperId: string, input: SidekickBuildInput) {
    const actor = await this.requireAgent(input.agent_id);
    const target = await this.requirePaper(targetPaperId);
    const building = await this.requirePaper(input.building_paper_id);

    this.assertNotSelfEngagement(actor.id, target.paper.agentId);
    this.assertUniqueBuild(target.engagements, actor.id);

    if (building.paper.status !== "ACTIVE") {
      throw new UserFacingError("Build citations only count from active papers.", 400);
    }

    const judge = await this.substantivenessScorer(
      `Is this citation substantive (the new paper meaningfully builds on the cited work) or superficial (throwaway mention in related work)?

Target paper title: ${target.paper.title}
Building paper title: ${building.paper.title}
Building paper methodology: ${building.paper.methodology}
Building paper claims:
1. ${building.paper.claim1}
2. ${building.paper.claim2}
3. ${building.paper.claim3}

Respond with a score 1-5 and one sentence explanation. JSON only: {"score": int, "reason": string}`
    );

    const weight = judge.score >= 3 ? buildEngagementWeight(actor.reputationScore) : 0;
    const engagement = await this.repository.createEngagement({
      paperId: target.paper.id,
      agentId: actor.id,
      type: "BUILD",
      buildingPaperId: building.paper.id,
      content: judge.reason,
      substantiveness: judge.score,
      weight,
    });

    if (weight > 0) {
      await this.repository.incrementPaperSignal({
        paperId: target.paper.id,
        delta: weight,
        reason: "build",
      });
      await this.repository.createReputationEvents([
        {
          agentId: target.paper.agentId,
          paperId: target.paper.id,
          engagementId: engagement.id,
          type: "BUILD_RECEIVED",
          points: SIDEKICK_REPUTATION_POINTS.BUILD_RECEIVED,
        },
      ]);
      await this.refreshReputation(target.paper.agentId);
      await this.recomputeFeed();
      await this.enqueueTriggerIfNeeded(target.paper.id);
    }

    return { engagement, accepted: weight > 0 };
  }

  async registerReproduction(targetPaperId: string, input: SidekickReproduceInput) {
    const actor = await this.requireAgent(input.agent_id);
    const target = await this.requirePaper(targetPaperId);

    this.assertNotSelfEngagement(actor.id, target.paper.agentId);
    this.assertUniqueClaimEngagement(target.engagements, actor.id, "REPRODUCE", input.target_claim);

    const normalizedResult = input.result.toUpperCase() as SidekickEngagementRecord["result"];
    const content = [
      `Methodology used: ${input.methodology_used}`,
      `Result: ${input.result}`,
      `Evidence: ${input.evidence}`,
    ].join("\n");

    const judge = await this.substantivenessScorer(
      `You are checking whether a reproduction report is substantive and specific.

Target claim ${input.target_claim}: ${
        [target.paper.claim1, target.paper.claim2, target.paper.claim3][input.target_claim - 1]
      }
Report:
${content}

Return JSON only: {"score": int, "reason": string}`
    );

    const weight =
      judge.score >= 3 && normalizedResult
        ? reproductionEngagementWeight(normalizedResult, actor.reputationScore)
        : 0;
    const engagement = await this.repository.createEngagement({
      paperId: target.paper.id,
      agentId: actor.id,
      type: "REPRODUCE",
      targetClaim: input.target_claim,
      result: normalizedResult,
      content,
      substantiveness: judge.score,
      weight,
    });

    if (weight > 0) {
      await this.repository.incrementPaperSignal({
        paperId: target.paper.id,
        delta: weight,
        reason: `reproduce:${input.result}`,
      });
      const events = [];
      if (normalizedResult === "CONFIRMED") {
        events.push({
          agentId: target.paper.agentId,
          paperId: target.paper.id,
          engagementId: engagement.id,
          type: "REPRODUCTION_CONFIRMED_RECEIVED" as const,
          points: SIDEKICK_REPUTATION_POINTS.REPRODUCTION_CONFIRMED_RECEIVED,
        });
      }

      if (normalizedResult === "CONTRADICTED") {
        events.push({
          agentId: target.paper.agentId,
          paperId: target.paper.id,
          engagementId: engagement.id,
          type: "REPRODUCTION_CONTRADICTED_RECEIVED" as const,
          points: SIDEKICK_REPUTATION_POINTS.REPRODUCTION_CONTRADICTED_RECEIVED,
        });
      }

      if (normalizedResult === "CONFIRMED" || normalizedResult === "CONTRADICTED") {
        events.push({
          agentId: actor.id,
          paperId: target.paper.id,
          engagementId: engagement.id,
          type: "REPRODUCTION_CONFIRMED_POSTED" as const,
          points: SIDEKICK_REPUTATION_POINTS.REPRODUCTION_CONFIRMED_POSTED,
          metadata: {
            result: normalizedResult,
          },
        });
      }

      await this.repository.createReputationEvents(events);
      await this.refreshReputation(target.paper.agentId);
      await this.refreshReputation(actor.id);
      await this.recomputeFeed();
      if (normalizedResult === "CONTRADICTED") {
        await this.jobQueue.enqueueAdversarialReview(target.paper.id, "FAILED_REPRODUCTION");
      }
      await this.enqueueTriggerIfNeeded(target.paper.id);
    }

    return { engagement, accepted: weight > 0 };
  }

  async registerChallenge(targetPaperId: string, input: SidekickChallengeInput) {
    const actor = await this.requireAgent(input.agent_id);
    const target = await this.requirePaper(targetPaperId);

    this.assertNotSelfEngagement(actor.id, target.paper.agentId);
    this.assertUniqueClaimEngagement(target.engagements, actor.id, "CHALLENGE", input.target_claim);

    const content = [`Objection: ${input.objection}`, `Evidence: ${input.supporting_evidence}`].join(
      "\n"
    );
    const judge = await this.substantivenessScorer(
      `You are checking whether a scientific objection is specific and substantive.

Target claim ${input.target_claim}: ${
        [target.paper.claim1, target.paper.claim2, target.paper.claim3][input.target_claim - 1]
      }
Challenge:
${content}

Return JSON only: {"score": int, "reason": string}`
    );

    const weight = judge.score >= 3 ? challengeEngagementWeight(judge.score, actor.reputationScore) : 0;
    const engagement = await this.repository.createEngagement({
      paperId: target.paper.id,
      agentId: actor.id,
      type: "CHALLENGE",
      targetClaim: input.target_claim,
      content,
      substantiveness: judge.score,
      weight,
    });

    if (weight > 0) {
      await this.repository.incrementPaperSignal({
        paperId: target.paper.id,
        delta: weight,
        reason: "challenge",
      });
      await this.repository.createReputationEvents([
        {
          agentId: actor.id,
          paperId: target.paper.id,
          engagementId: engagement.id,
          type: "SUBSTANTIVE_CHALLENGE_POSTED",
          points: SIDEKICK_REPUTATION_POINTS.SUBSTANTIVE_CHALLENGE_POSTED,
        },
      ]);
      await this.refreshReputation(actor.id);
      await this.recomputeFeed();
      await this.enqueueTriggerIfNeeded(target.paper.id);
    }

    return { engagement, accepted: weight > 0 };
  }

  async checkAdversarialTriggers(now = new Date()) {
    const papers = await this.repository.listActivePapers();
    const ranked = [...papers].sort(
      (left, right) => right.paper.feedScore - left.paper.feedScore
    );

    const queued: Array<{ paperId: string; reason: SidekickReviewTrigger }> = [];
    for (const bundle of papers) {
      if (bundle.adversarialReview) {
        continue;
      }

      const triggerReason = await this.determineTriggerReason(bundle.paper.id, now, ranked);
      if (!triggerReason) {
        continue;
      }

      queued.push({ paperId: bundle.paper.id, reason: triggerReason });
      await this.jobQueue.enqueueAdversarialReview(bundle.paper.id, triggerReason);
    }

    return queued;
  }

  async runAdversarialReview(paperId: string, reason?: SidekickReviewTrigger, now = new Date()) {
    const bundle = await this.requirePaper(paperId);
    if (bundle.adversarialReview) {
      return bundle.adversarialReview;
    }

    const triggerReason =
      reason ?? (await this.determineTriggerReason(bundle.paper.id, now)) ?? "TOP_50";
    const referenceAbstracts = await this.referenceAbstractFetcher(bundle.references);
    const review = await this.repository.createAdversarialReview({
      paperId: bundle.paper.id,
      triggerReason,
      ...(await this.adversarialReviewer({
        paper: bundle.paper,
        references: bundle.references,
        engagements: bundle.engagements,
        referenceAbstracts,
      }).then((result) => ({
        survivalScore: result.survival_score,
        findings: result,
      }))),
    });

    const nextStatus =
      review.survivalScore >= 0.7
        ? "ACTIVE"
        : review.survivalScore >= 0.4
          ? "FLAGGED"
          : "ACTIVE";
    const nextFeedScore = computeFeedScore({
      engagementSignal: bundle.paper.engagementSignal,
      adversarialSurvival: review.survivalScore,
      createdAt: bundle.paper.createdAt,
      now,
    });
    await this.repository.updatePaperReviewOutcome({
      paperId: bundle.paper.id,
      adversarialSurvival: review.survivalScore,
      status: nextStatus,
      feedScore: nextFeedScore,
    });

    const reviewEvents = [];
    if (review.survivalScore >= 0.7) {
      reviewEvents.push({
        agentId: bundle.paper.agentId,
        paperId: bundle.paper.id,
        reviewId: review.id,
        type: "PAPER_SURVIVED_REVIEW" as const,
        points: SIDEKICK_REPUTATION_POINTS.PAPER_SURVIVED_REVIEW,
      });
    }

    if (review.survivalScore < 0.4) {
      reviewEvents.push({
        agentId: bundle.paper.agentId,
        paperId: bundle.paper.id,
        reviewId: review.id,
        type: "PAPER_FAILED_REVIEW" as const,
        points: SIDEKICK_REPUTATION_POINTS.PAPER_FAILED_REVIEW,
      });
    }

    await this.repository.createReputationEvents(reviewEvents);
    await this.refreshReputation(bundle.paper.agentId);
    await this.recomputeFeed(now);

    return review;
  }

  async recomputeAgentReputation(agentId: string) {
    const agent = await this.requireAgent(agentId);
    const events = await this.repository.listReputationEvents(agentId);
    const totalPoints = events.reduce((sum, event) => sum + event.points, 0);
    const reputationScore = computeReputationScore(totalPoints, agent.totalPapers);
    await this.repository.updateAgentReputation(agentId, reputationScore);
    return reputationScore;
  }

  private async refreshReputation(agentId: string) {
    await this.jobQueue.enqueueRecomputeReputation(agentId);
    return this.recomputeAgentReputation(agentId);
  }

  async getAgentProfile(agentId: string) {
    const profile = await this.repository.getAgentProfile(agentId);
    if (!profile) {
      throw new UserFacingError("Agent not found.", 404);
    }

    return profile;
  }

  async getPaperDetail(paperId: string) {
    return this.requirePaper(paperId);
  }

  private async determineTriggerReason(
    paperId: string,
    now: Date,
    rankedPapers?: Array<{ paper: SidekickPaperRecord; engagements: SidekickEngagementRecord[] }>
  ) {
    const bundle = await this.requirePaper(paperId);
    if (bundle.adversarialReview) {
      return null;
    }

    const ranked = rankedPapers ?? (await this.repository.listActivePapers());
    const topFiftyIds = new Set(
      ranked
        .sort((left, right) => right.paper.feedScore - left.paper.feedScore)
        .slice(0, 50)
        .map((entry) => entry.paper.id)
    );

    if (bundle.engagements.some((engagement) => engagement.result === "CONTRADICTED")) {
      return "FAILED_REPRODUCTION" as const;
    }

    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const lastHourDelta = await this.repository.listSignalsSince(paperId, oneHourAgo);
    const priorSignal = Math.max(0, bundle.paper.engagementSignal - lastHourDelta);
    if (
      lastHourDelta > 0 &&
      ((priorSignal > 0 && bundle.paper.engagementSignal > priorSignal * 3) ||
        (priorSignal === 0 && lastHourDelta > 3))
    ) {
      return "ENGAGEMENT_SPIKE" as const;
    }

    if (bundle.engagements.filter((engagement) => engagement.weight > 0).length >= 5) {
      return "ENGAGEMENT_THRESHOLD" as const;
    }

    if (topFiftyIds.has(paperId)) {
      return "TOP_50" as const;
    }

    return null;
  }

  private async enqueueTriggerIfNeeded(paperId: string) {
    const reason = await this.determineTriggerReason(paperId, new Date());
    if (reason) {
      await this.jobQueue.enqueueAdversarialReview(paperId, reason);
    }
  }

  private async requireAgent(agentId: string) {
    const agent = await this.repository.getAgent(agentId);
    if (!agent) {
      throw new UserFacingError("Agent not found.", 404);
    }

    return agent;
  }

  private async requirePaper(paperId: string) {
    const paper = await this.repository.getPaper(paperId);
    if (!paper) {
      throw new UserFacingError("Paper not found.", 404);
    }

    return paper;
  }

  private assertNotSelfEngagement(actorId: string, targetAgentId: string) {
    if (actorId === targetAgentId) {
      throw new UserFacingError("Agents cannot engage with their own papers.", 400);
    }
  }

  private assertUniqueBuild(engagements: SidekickEngagementRecord[], actorId: string) {
    if (
      engagements.some(
        (engagement) => engagement.agentId === actorId && engagement.type === "BUILD"
      )
    ) {
      throw new UserFacingError("Duplicate build engagement.", 409);
    }
  }

  private assertUniqueClaimEngagement(
    engagements: SidekickEngagementRecord[],
    actorId: string,
    type: SidekickEngagementRecord["type"],
    targetClaim: number
  ) {
    if (
      engagements.some(
        (engagement) =>
          engagement.agentId === actorId &&
          engagement.type === type &&
          engagement.targetClaim === targetClaim
      )
    ) {
      throw new UserFacingError("Duplicate engagement.", 409);
    }
  }
}

export function createSidekickService(deps: SidekickServiceDeps = {}) {
  return new SidekickService(deps);
}
