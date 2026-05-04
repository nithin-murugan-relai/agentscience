import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAnalyticsEvent } from "@/lib/shared-analytics";

const analyticsEventSchema = z.object({
  visitorId: z.string().trim().min(16).max(128),
  path: z.string().trim().min(1).max(512),
  referrer: z.string().trim().max(1024).nullish(),
});

export async function POST(request: Request) {
  const parsed = analyticsEventSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await recordAnalyticsEvent({
    ...parsed.data,
    userAgent: request.headers.get("user-agent"),
    country:
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry"),
  });

  return NextResponse.json({ ok: true });
}
