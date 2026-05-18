import { NextResponse } from "next/server";

import { runBlobStorageMaintenance } from "@/lib/paper-storage-policy";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await runBlobStorageMaintenance({ deleteOrphans: true });
  return NextResponse.json({
    ok: true,
    ...result,
  });
}
