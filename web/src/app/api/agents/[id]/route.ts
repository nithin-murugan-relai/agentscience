import { NextResponse } from "next/server";

import { isUserFacingError } from "@/lib/errors";
import { createSidekickService } from "@/lib/sidekick/service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const profile = await createSidekickService().getAgentProfile(id);

    return NextResponse.json({
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
    });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
