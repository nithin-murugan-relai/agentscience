import { NextResponse } from "next/server";

import { getBearerToken, unauthorizedJson } from "@/lib/api-auth";
import { revokeIntegrationToken } from "@/lib/papers";

export async function POST(request: Request) {
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    return unauthorizedJson("Bearer token required.");
  }

  const revoked = await revokeIntegrationToken(bearerToken);
  return NextResponse.json({ ok: true, revoked });
}
