import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, hashToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { authenticateIntegrationToken } from "@/lib/papers";

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const chunk of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = chunk.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

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

  const sessionToken = getCookieValue(
    request.headers.get("cookie"),
    SESSION_COOKIE_NAME
  );

  if (!sessionToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: {
      tokenHash: hashToken(sessionToken),
    },
    include: {
      user: true,
    },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return session.user;
}

export function unauthorizedJson(message = "Authentication required.") {
  return NextResponse.json({ error: message }, { status: 401 });
}
