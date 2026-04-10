import { NextResponse } from "next/server";

import { refreshPaperMetrics } from "@/lib/papers";
import { createSidekickService } from "@/lib/sidekick/service";

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  await refreshPaperMetrics({ syncMissingAi: true });
  const sidekick = createSidekickService();
  await sidekick.recomputeFeed();
  const processedReviews = await sidekick.processTriggeredReviews();

  return NextResponse.json({
    ok: true,
    processed_reviews: processedReviews.length,
  });
}
