import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { refreshPaperMetrics } from "@/lib/papers";
import { validateBrowserOrigin } from "@/lib/request";
import { createSidekickService } from "@/lib/sidekick/service";

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.json({ error: invalidOrigin }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  await refreshPaperMetrics({ syncMissingAi: true });
  const sidekick = createSidekickService();
  await sidekick.recomputeFeed();
  await sidekick.processTriggeredReviews();

  return NextResponse.json({ ok: true });
}
