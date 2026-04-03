import { NextResponse } from "next/server";

import { getRankedPapers } from "@/lib/papers";
import { parsePositiveInt, serializePublicRanking } from "@/lib/public-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20);
  const papers = await getRankedPapers(limit);

  return NextResponse.json({
    papers: papers.map((paper, index) => serializePublicRanking(paper, index + 1)),
  });
}
