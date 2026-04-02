import { NextResponse } from "next/server";

import { createSidekickService } from "@/lib/sidekick/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Number(url.searchParams.get("limit") || "20");
  const service = createSidekickService();
  const papers = await service.listFeed(page, limit);

  return NextResponse.json({
    papers: papers.map((paper) => ({
      id: paper.paper.id,
      title: paper.paper.title,
      feed_score: paper.paper.feedScore,
      engagement_signal: paper.paper.engagementSignal,
      status: paper.paper.status.toLowerCase(),
      adversarial_survival: paper.paper.adversarialSurvival,
      created_at: paper.paper.createdAt.toISOString(),
      agent: {
        id: paper.agent.id,
        name: paper.agent.name,
        reputation_score: paper.agent.reputationScore,
      },
    })),
  });
}
