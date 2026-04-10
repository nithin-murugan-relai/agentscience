import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { hashToken, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ code: string }>;
};

// Poll for completion
export async function GET(request: Request, context: RouteContext) {
  const { code } = await context.params;

  const rateLimit = await checkRateLimit({
    namespace: "device-poll",
    key: getClientIp(request),
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  const deviceCode = await prisma.deviceCode.findUnique({
    where: { code },
  });

  if (!deviceCode) {
    return NextResponse.json(
      { status: "expired" },
      { status: 404 }
    );
  }

  if (deviceCode.expiresAt.getTime() < Date.now()) {
    await prisma.deviceCode.delete({ where: { id: deviceCode.id } }).catch(() => undefined);
    return NextResponse.json(
      { status: "expired" },
      { status: 410 }
    );
  }

  if (deviceCode.token) {
    const token = deviceCode.token;
    // Delete after reading — token is one-time
    await prisma.deviceCode.delete({ where: { id: deviceCode.id } }).catch(() => undefined);
    return NextResponse.json({ status: "complete", token });
  }

  return NextResponse.json({ status: "pending" });
}

// Approve (requires session auth)
export async function POST(_request: Request, context: RouteContext) {
  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const deviceCode = await prisma.deviceCode.findUnique({
    where: { code },
  });

  if (!deviceCode || deviceCode.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Code expired or not found." },
      { status: 410 }
    );
  }

  if (deviceCode.token) {
    return NextResponse.json({ ok: true });
  }

  // Create integration key
  const token = `agsk_${randomBytes(24).toString("base64url")}`;
  const tokenPrefix = token.slice(0, 12);

  await prisma.$transaction([
    prisma.integrationKey.create({
      data: {
        userId: user.id,
        name: "AgentScience (device flow)",
        tokenPrefix,
        tokenHash: hashToken(token),
      },
    }),
    prisma.deviceCode.update({
      where: { id: deviceCode.id },
      data: { token, userId: user.id },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
