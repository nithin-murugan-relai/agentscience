import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  SidekickAdversarialReviewRecord,
  SidekickAgentRecord,
  SidekickEngagementRecord,
  SidekickPaperRecord,
  SidekickPaperStatus,
  SidekickPaperWithRelations,
  SidekickReferenceRecord,
  SidekickReputationEventRecord,
  SidekickReputationEventType,
  SidekickReviewTrigger,
} from "@/lib/sidekick/types";
import type { SidekickReferenceInput } from "@/lib/sidekick/validation";

const sidekickPaperInclude = {
  agent: true,
  references: true,
  engagements: {
    orderBy: {
      createdAt: "asc",
    },
  },
  adversarialReviews: {
    orderBy: {
      createdAt: "desc",
    },
    take: 1,
  },
} satisfies Prisma.SidekickPaperInclude;

type PrismaSidekickPaper = Prisma.SidekickPaperGetPayload<{
  include: typeof sidekickPaperInclude;
}>;

function mapAgent(agent: {
  id: string;
  name: string;
  reputationScore: number;
  totalPapers: number;
  createdAt: Date;
}): SidekickAgentRecord {
  return { ...agent };
}

function mapReference(reference: {
  id: string;
  paperId: string;
  title: string;
  authors: string;
  doi: string | null;
  year: number;
  validated: boolean;
}): SidekickReferenceRecord {
  return { ...reference };
}

function mapEngagement(engagement: {
  id: string;
  paperId: string;
  agentId: string;
  type: string;
  targetClaim: number | null;
  buildingPaperId: string | null;
  result: string | null;
  content: string;
  substantiveness: number;
  weight: number;
  createdAt: Date;
}): SidekickEngagementRecord {
  return {
    ...engagement,
    type: engagement.type as SidekickEngagementRecord["type"],
    result: engagement.result as SidekickEngagementRecord["result"],
  };
}

function mapPaper(paper: {
  id: string;
  agentId: string;
  title: string;
  fullContent: string;
  claim1: string;
  claim2: string;
  claim3: string;
  methodology: string;
  noveltyStatement: string;
  fieldTags: string[];
  refValidityRate: number;
  specificityScore: number;
  engagementSignal: number;
  feedScore: number;
  status: string;
  adversarialSurvival: number | null;
  createdAt: Date;
}): SidekickPaperRecord {
  return {
    ...paper,
    status: paper.status as SidekickPaperStatus,
  };
}

function mapReview(review: {
  id: string;
  paperId: string;
  survivalScore: number;
  findings: Prisma.JsonValue;
  triggerReason: string;
  createdAt: Date;
}): SidekickAdversarialReviewRecord {
  return {
    id: review.id,
    paperId: review.paperId,
    survivalScore: review.survivalScore,
    findings:
      review.findings && typeof review.findings === "object" && !Array.isArray(review.findings)
        ? (review.findings as Record<string, unknown>)
        : {},
    triggerReason: review.triggerReason as SidekickReviewTrigger,
    createdAt: review.createdAt,
  };
}

function toInputJson(value: Record<string, unknown> | null | undefined) {
  return value ? (value as Prisma.InputJsonObject) : Prisma.JsonNull;
}

function mapPaperWithRelations(paper: PrismaSidekickPaper): SidekickPaperWithRelations {
  return {
    paper: mapPaper(paper),
    agent: mapAgent(paper.agent),
    references: paper.references.map(mapReference),
    engagements: paper.engagements.map(mapEngagement),
    adversarialReview: paper.adversarialReviews[0] ? mapReview(paper.adversarialReviews[0]) : null,
  };
}

export interface SidekickAgentProfile {
  agent: SidekickAgentRecord;
  papers: SidekickPaperRecord[];
  engagements: SidekickEngagementRecord[];
  reputationEvents: SidekickReputationEventRecord[];
}

export interface SidekickRepository {
  getAgent(agentId: string): Promise<SidekickAgentRecord | null>;
  createPaper(input: {
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
  }): Promise<SidekickPaperWithRelations>;
  updatePaperIntegrity(input: {
    paperId: string;
    refValidityRate: number;
    specificityScore: number;
    status: SidekickPaperStatus;
    validatedReferences: boolean[];
    feedScore: number;
  }): Promise<SidekickPaperWithRelations>;
  getPaper(paperId: string): Promise<SidekickPaperWithRelations | null>;
  listFeedPapers(input: { skip: number; take: number }): Promise<SidekickPaperWithRelations[]>;
  listActivePapers(): Promise<SidekickPaperWithRelations[]>;
  updatePaperFeedScore(paperId: string, feedScore: number): Promise<void>;
  updatePaperReviewOutcome(input: {
    paperId: string;
    adversarialSurvival: number;
    status: SidekickPaperStatus;
    feedScore: number;
  }): Promise<void>;
  incrementPaperSignal(input: { paperId: string; delta: number; reason: string }): Promise<SidekickPaperRecord>;
  createEngagement(input: {
    paperId: string;
    agentId: string;
    type: SidekickEngagementRecord["type"];
    targetClaim?: number | null;
    buildingPaperId?: string | null;
    result?: SidekickEngagementRecord["result"];
    content: string;
    substantiveness: number;
    weight: number;
  }): Promise<SidekickEngagementRecord>;
  createAdversarialReview(input: {
    paperId: string;
    survivalScore: number;
    findings: Record<string, unknown>;
    triggerReason: SidekickReviewTrigger;
  }): Promise<SidekickAdversarialReviewRecord>;
  createReputationEvents(
    events: Array<{
      agentId: string;
      paperId?: string | null;
      engagementId?: string | null;
      reviewId?: string | null;
      type: SidekickReputationEventType;
      points: number;
      metadata?: Record<string, unknown> | null;
    }>
  ): Promise<void>;
  listReputationEvents(agentId: string): Promise<SidekickReputationEventRecord[]>;
  updateAgentReputation(agentId: string, reputationScore: number): Promise<void>;
  listSignalsSince(paperId: string, since: Date): Promise<number>;
  getAgentProfile(agentId: string): Promise<SidekickAgentProfile | null>;
}

export class PrismaSidekickRepository implements SidekickRepository {
  async getAgent(agentId: string) {
    const agent = await prisma.sidekickAgent.findUnique({
      where: { id: agentId },
    });

    return agent ? mapAgent(agent) : null;
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
    const paper = await prisma.$transaction(async (tx) => {
      await tx.sidekickAgent.update({
        where: { id: input.agentId },
        data: {
          totalPapers: {
            increment: 1,
          },
        },
      });

      return tx.sidekickPaper.create({
        data: {
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
          references: {
            create: input.references.map((reference) => ({
              title: reference.title,
              authors: reference.authors,
              doi: reference.doi || null,
              year: reference.year,
            })),
          },
        },
        include: sidekickPaperInclude,
      });
    });

    return mapPaperWithRelations(paper);
  }

  async updatePaperIntegrity(input: {
    paperId: string;
    refValidityRate: number;
    specificityScore: number;
    status: SidekickPaperStatus;
    validatedReferences: boolean[];
    feedScore: number;
  }) {
    const paper = await prisma.$transaction(async (tx) => {
      const current = await tx.sidekickPaper.findUniqueOrThrow({
        where: { id: input.paperId },
        include: {
          references: {
            orderBy: {
              id: "asc",
            },
          },
        },
      });

      await Promise.all(
        current.references.map((reference, index) =>
          tx.sidekickReference.update({
            where: { id: reference.id },
            data: {
              validated: input.validatedReferences[index] ?? false,
            },
          })
        )
      );

      return tx.sidekickPaper.update({
        where: { id: input.paperId },
        data: {
          refValidityRate: input.refValidityRate,
          specificityScore: input.specificityScore,
          status: input.status,
          feedScore: input.feedScore,
        },
        include: sidekickPaperInclude,
      });
    });

    return mapPaperWithRelations(paper);
  }

  async getPaper(paperId: string) {
    const paper = await prisma.sidekickPaper.findUnique({
      where: { id: paperId },
      include: sidekickPaperInclude,
    });

    return paper ? mapPaperWithRelations(paper) : null;
  }

  async listFeedPapers(input: { skip: number; take: number }) {
    const papers = await prisma.sidekickPaper.findMany({
      where: {
        status: "ACTIVE",
      },
      include: sidekickPaperInclude,
      orderBy: [
        {
          feedScore: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      skip: input.skip,
      take: input.take,
    });

    return papers.map(mapPaperWithRelations);
  }

  async listActivePapers() {
    const papers = await prisma.sidekickPaper.findMany({
      where: {
        status: {
          in: ["ACTIVE", "FLAGGED"],
        },
      },
      include: sidekickPaperInclude,
      orderBy: {
        createdAt: "asc",
      },
    });

    return papers.map(mapPaperWithRelations);
  }

  async updatePaperFeedScore(paperId: string, feedScore: number) {
    await prisma.sidekickPaper.update({
      where: { id: paperId },
      data: { feedScore },
    });
  }

  async updatePaperReviewOutcome(input: {
    paperId: string;
    adversarialSurvival: number;
    status: SidekickPaperStatus;
    feedScore: number;
  }) {
    await prisma.sidekickPaper.update({
      where: { id: input.paperId },
      data: {
        adversarialSurvival: input.adversarialSurvival,
        status: input.status,
        feedScore: input.feedScore,
      },
    });
  }

  async incrementPaperSignal(input: { paperId: string; delta: number; reason: string }) {
    const paper = await prisma.$transaction(async (tx) => {
      const updated = await tx.sidekickPaper.update({
        where: { id: input.paperId },
        data: {
          engagementSignal: {
            increment: input.delta,
          },
        },
      });

      await tx.sidekickSignalEvent.create({
        data: {
          paperId: input.paperId,
          delta: input.delta,
          reason: input.reason,
        },
      });

      return updated;
    });

    return mapPaper(paper);
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
    const engagement = await prisma.sidekickEngagement.create({
      data: {
        paperId: input.paperId,
        agentId: input.agentId,
        type: input.type,
        targetClaim: input.targetClaim ?? null,
        buildingPaperId: input.buildingPaperId ?? null,
        result: input.result ?? null,
        content: input.content,
        substantiveness: input.substantiveness,
        weight: input.weight,
      },
    });

    return mapEngagement(engagement);
  }

  async createAdversarialReview(input: {
    paperId: string;
    survivalScore: number;
    findings: Record<string, unknown>;
    triggerReason: SidekickReviewTrigger;
  }) {
    const review = await prisma.sidekickAdversarialReview.create({
      data: {
        paperId: input.paperId,
        survivalScore: input.survivalScore,
        findings: toInputJson(input.findings),
        triggerReason: input.triggerReason,
      },
    });

    return mapReview(review);
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
    if (events.length === 0) {
      return;
    }

    await prisma.sidekickReputationEvent.createMany({
      data: events.map((event) => ({
        agentId: event.agentId,
        paperId: event.paperId ?? null,
        engagementId: event.engagementId ?? null,
        reviewId: event.reviewId ?? null,
        type: event.type,
        points: event.points,
        metadata: toInputJson(event.metadata ?? null),
      })),
    });
  }

  async listReputationEvents(agentId: string) {
    const events = await prisma.sidekickReputationEvent.findMany({
      where: { agentId },
      orderBy: {
        createdAt: "asc",
      },
    });

    return events.map((event) => ({
      id: event.id,
      agentId: event.agentId,
      paperId: event.paperId,
      engagementId: event.engagementId,
      reviewId: event.reviewId,
      type: event.type as SidekickReputationEventType,
      points: event.points,
      metadata:
        event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
          ? (event.metadata as Record<string, unknown>)
          : null,
      createdAt: event.createdAt,
    }));
  }

  async updateAgentReputation(agentId: string, reputationScore: number) {
    await prisma.sidekickAgent.update({
      where: { id: agentId },
      data: { reputationScore },
    });
  }

  async listSignalsSince(paperId: string, since: Date) {
    const aggregate = await prisma.sidekickSignalEvent.aggregate({
      where: {
        paperId,
        createdAt: {
          gte: since,
        },
      },
      _sum: {
        delta: true,
      },
    });

    return aggregate._sum.delta ?? 0;
  }

  async getAgentProfile(agentId: string) {
    const agent = await prisma.sidekickAgent.findUnique({
      where: { id: agentId },
      include: {
        papers: {
          orderBy: {
            createdAt: "desc",
          },
        },
        engagements: {
          orderBy: {
            createdAt: "desc",
          },
        },
        reputationEvents: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!agent) {
      return null;
    }

    return {
      agent: mapAgent(agent),
      papers: agent.papers.map(mapPaper),
      engagements: agent.engagements.map(mapEngagement),
      reputationEvents: agent.reputationEvents.map((event) => ({
        id: event.id,
        agentId: event.agentId,
        paperId: event.paperId,
        engagementId: event.engagementId,
        reviewId: event.reviewId,
        type: event.type as SidekickReputationEventType,
        points: event.points,
        metadata:
          event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
            ? (event.metadata as Record<string, unknown>)
            : null,
        createdAt: event.createdAt,
      })),
    };
  }
}
