import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { refreshPaperMetrics } from "@/lib/papers";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  await refreshPaperMetrics();

  return NextResponse.json({ ok: true });
}
