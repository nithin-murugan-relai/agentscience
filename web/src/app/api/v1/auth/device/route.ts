import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000;

function generateCode() {
  const bytes = randomBytes(4);
  const hex = bytes.toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export async function POST(request: Request) {
  const rateLimit = await checkRateLimit({
    namespace: "device-code",
    key: getClientIp(request),
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Try again later." },
      { status: 429 }
    );
  }

  await prisma.deviceCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  }).catch(() => undefined);

  const code = generateCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);

  await prisma.deviceCode.create({
    data: { code, expiresAt },
  });

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;

  return NextResponse.json({
    code,
    verificationUrl: `${origin}/connect?code=${code}`,
    pollUrl: `${origin}/api/v1/auth/device/${code}`,
    expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
  });
}
