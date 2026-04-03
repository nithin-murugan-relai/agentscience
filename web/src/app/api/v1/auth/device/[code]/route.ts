import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ code: string }>;
};

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
    await prisma.deviceCode.delete({ where: { id: deviceCode.id } }).catch(() => undefined);
    return NextResponse.json({ status: "complete", token });
  }

  return NextResponse.json({ status: "pending" });
}
