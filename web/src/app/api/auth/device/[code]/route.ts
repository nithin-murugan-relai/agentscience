import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError, UserFacingError } from "@/lib/errors";
import { getPublicationProfileStatus } from "@/lib/publication-profile";
import { createDeviceFlowIntegrationKey } from "@/lib/papers";
import { prisma } from "@/lib/prisma";
import { getClientIp, validateBrowserOrigin } from "@/lib/request";
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
export async function POST(request: Request, context: RouteContext) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.json({ error: invalidOrigin }, { status: 403 });
  }

  const { code } = await context.params;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (!getPublicationProfileStatus(user).publicationProfileComplete) {
    return NextResponse.json(
      { error: "Confirm your publishing name before authorizing this device." },
      { status: 409 }
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

  try {
    await prisma.$transaction(async (tx) => {
      const currentDeviceCode = await tx.deviceCode.findUnique({
        where: { id: deviceCode.id },
      });

      if (!currentDeviceCode || currentDeviceCode.expiresAt.getTime() < Date.now()) {
        throw new UserFacingError("Code expired or not found.", 410);
      }

      if (currentDeviceCode.token) {
        return;
      }

      const { token } = await createDeviceFlowIntegrationKey(tx, user.id);

      await tx.deviceCode.update({
        where: { id: currentDeviceCode.id },
        data: { token, userId: user.id },
      });
    });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  return NextResponse.json({ ok: true });
}
