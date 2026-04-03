import { NextResponse } from "next/server";

import { parsePositiveInt, serializePublicFeedEntry } from "@/lib/public-api";
import { createSidekickService } from "@/lib/sidekick/service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = parsePositiveInt(url.searchParams.get("page"), 1);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20);
  const papers = await createSidekickService().listFeed(page, limit);

  return NextResponse.json({
    papers: papers.map(serializePublicFeedEntry),
  });
}
