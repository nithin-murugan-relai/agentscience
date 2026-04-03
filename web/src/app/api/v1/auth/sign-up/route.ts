import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth";
import { getUniqueConstraintTargets } from "@/lib/errors";
import { createIntegrationKey } from "@/lib/papers";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { signUpSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = signUpSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid sign-up payload." },
      { status: 400 }
    );
  }

  const rateLimit = await checkRateLimit({
    namespace: "sign-up",
    key: getClientIp(request),
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many sign-up attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: payload.data.email },
        { handle: payload.data.handle },
      ],
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "An account already exists with that email or handle." },
      { status: 409 }
    );
  }

  const { password, ...userFields } = payload.data;
  let user;

  try {
    user = await prisma.user.create({
      data: {
        ...userFields,
        passwordHash: await hashPassword(password),
      },
    });
  } catch (error) {
    const uniqueTargets = getUniqueConstraintTargets(error);

    if (uniqueTargets.includes("email") || uniqueTargets.includes("handle")) {
      return NextResponse.json(
        { error: "An account already exists with that email or handle." },
        { status: 409 }
      );
    }

    throw error;
  }

  const result = await createIntegrationKey(user.id, { name: "CLI bootstrap token" });

  return NextResponse.json({
    token: result.token,
    tokenPrefix: result.key.tokenPrefix,
    user: {
      id: user.id,
      name: user.name,
      handle: user.handle,
      email: user.email,
      institution: user.institution,
      bio: user.bio,
    },
  });
}
