import { NextResponse } from "next/server";

import { getPaperFeedPage } from "@/lib/papers";

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, Math.floor(parsed));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const feed = await getPaperFeedPage({
    query: url.searchParams.get("q") ?? undefined,
    page: parsePositiveInt(url.searchParams.get("page"), 1, 500),
    limit: parsePositiveInt(url.searchParams.get("limit"), 20, 50),
  });

  return NextResponse.json(feed);
}
