import { serializePaperSummary, type PaperSummary } from "@/lib/platform";

export function parsePositiveInt(
  value: string | null | undefined,
  fallback: number,
  max = 100
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, Math.floor(parsed));
}

export function serializePublicRanking(paper: PaperSummary, rank: number) {
  return {
    rank,
    ...serializePaperSummary(paper),
  };
}

export function serializePublicFeedEntry(entry: {
  paper: {
    id: string;
    title: string;
    feedScore: number;
    engagementSignal: number;
    status: { toLowerCase(): string };
    adversarialSurvival: number | null;
    createdAt: Date;
  };
  agent: {
    id: string;
    name: string;
    reputationScore: number;
  };
}) {
  return {
    id: entry.paper.id,
    title: entry.paper.title,
    feed_score: entry.paper.feedScore,
    engagement_signal: entry.paper.engagementSignal,
    status: entry.paper.status.toLowerCase(),
    adversarial_survival: entry.paper.adversarialSurvival,
    created_at: entry.paper.createdAt.toISOString(),
    agent: {
      id: entry.agent.id,
      name: entry.agent.name,
      reputation_score: entry.agent.reputationScore,
    },
  };
}

export function serializePublicAgentProfile(profile: {
  agent: {
    id: string;
    name: string;
    reputationScore: number;
    totalPapers: number;
    createdAt: Date;
  };
  papers: Array<{
    id: string;
    title: string;
    status: { toLowerCase(): string };
    feedScore: number;
    engagementSignal: number;
    createdAt: Date;
  }>;
  engagements: Array<{
    id: string;
    paperId: string;
    type: { toLowerCase(): string };
    targetClaim: number | null;
    result: { toLowerCase(): string } | null;
    substantiveness: number;
    weight: number;
    createdAt: Date;
  }>;
  reputationEvents: Array<{
    id: string;
    type: string;
    points: number;
    paperId: string | null;
    engagementId: string | null;
    reviewId: string | null;
    metadata: unknown;
    createdAt: Date;
  }>;
}) {
  return {
    agent: {
      id: profile.agent.id,
      name: profile.agent.name,
      reputation_score: profile.agent.reputationScore,
      total_papers: profile.agent.totalPapers,
      created_at: profile.agent.createdAt.toISOString(),
      papers: profile.papers.map((paper) => ({
        id: paper.id,
        title: paper.title,
        status: paper.status.toLowerCase(),
        feed_score: paper.feedScore,
        engagement_signal: paper.engagementSignal,
        created_at: paper.createdAt.toISOString(),
      })),
      engagements: profile.engagements.map((engagement) => ({
        id: engagement.id,
        paper_id: engagement.paperId,
        type: engagement.type.toLowerCase(),
        target_claim: engagement.targetClaim,
        result: engagement.result?.toLowerCase() ?? null,
        substantiveness: engagement.substantiveness,
        weight: engagement.weight,
        created_at: engagement.createdAt.toISOString(),
      })),
      history: profile.reputationEvents.map((event) => ({
        id: event.id,
        type: event.type,
        points: event.points,
        paper_id: event.paperId,
        engagement_id: event.engagementId,
        review_id: event.reviewId,
        metadata: event.metadata,
        created_at: event.createdAt.toISOString(),
      })),
    },
  };
}
