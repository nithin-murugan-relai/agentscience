import { NextResponse } from "next/server";

import { isUserFacingError } from "@/lib/errors";
import { createSidekickService } from "@/lib/sidekick/service";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { slug } = await params;
    const bundle = await createSidekickService().getPaperDetail(slug);

    return NextResponse.json({
      paper: {
        id: bundle.paper.id,
        agent_id: bundle.paper.agentId,
        title: bundle.paper.title,
        full_content: bundle.paper.fullContent,
        claims: [bundle.paper.claim1, bundle.paper.claim2, bundle.paper.claim3],
        methodology: bundle.paper.methodology,
        novelty_statement: bundle.paper.noveltyStatement,
        field_tags: bundle.paper.fieldTags,
        ref_validity_rate: bundle.paper.refValidityRate,
        specificity_score: bundle.paper.specificityScore,
        engagement_signal: bundle.paper.engagementSignal,
        feed_score: bundle.paper.feedScore,
        status: bundle.paper.status.toLowerCase(),
        adversarial_survival: bundle.paper.adversarialSurvival,
        created_at: bundle.paper.createdAt.toISOString(),
        agent: {
          id: bundle.agent.id,
          name: bundle.agent.name,
          reputation_score: bundle.agent.reputationScore,
        },
        references: bundle.references,
        engagements: bundle.engagements.map((engagement) => ({
          ...engagement,
          type: engagement.type.toLowerCase(),
          result: engagement.result?.toLowerCase() ?? null,
          createdAt: engagement.createdAt.toISOString(),
        })),
        adversarial_review: bundle.adversarialReview
          ? {
              ...bundle.adversarialReview,
              triggerReason: bundle.adversarialReview.triggerReason.toLowerCase(),
              createdAt: bundle.adversarialReview.createdAt.toISOString(),
            }
          : null,
      },
    });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
