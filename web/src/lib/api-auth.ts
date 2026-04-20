import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { authenticateIntegrationToken } from "@/lib/papers";

export function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  return authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : null;
}

export async function getApiUser(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    return authenticateIntegrationToken(bearerToken);
  }

  return getCurrentUser();
}

export function unauthorizedJson(message = "Authentication required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}
