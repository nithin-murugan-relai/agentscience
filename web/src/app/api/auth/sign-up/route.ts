import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { applySessionCookie, createSession, hashPassword } from "@/lib/auth";
import { getUniqueConstraintTargets } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  buildPathWithNext,
  getClientIp,
  getSafeRedirectPath,
  validateBrowserOrigin,
} from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { signUpSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/sign-up?error=${encodeURIComponent(invalidOrigin)}`, request.url),
      { status: 303 }
    );
  }

  const formData = await request.formData();
  const payload = signUpSchema.safeParse(Object.fromEntries(formData));
  const nextPath = getSafeRedirectPath(formData.get("next") as string | null, "/");

  if (!payload.success) {
    const signUpUrl = new URL(buildPathWithNext("/sign-up", nextPath), request.url);
    signUpUrl.searchParams.set(
      "error",
      payload.error.issues[0]?.message ?? "Invalid sign-up form."
    );

    return NextResponse.redirect(
      signUpUrl,
      { status: 303 }
    );
  }

  const rateLimit = await checkRateLimit({
    namespace: "sign-up",
    key: getClientIp(request),
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    const signUpUrl = new URL(buildPathWithNext("/sign-up", nextPath), request.url);
    signUpUrl.searchParams.set("error", "Too many sign-up attempts. Try again later.");

    return NextResponse.redirect(signUpUrl, {
      status: 303,
      headers: {
        "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
      },
    });
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
    const signUpUrl = new URL(buildPathWithNext("/sign-up", nextPath), request.url);
    signUpUrl.searchParams.set(
      "error",
      "An account already exists with that email or handle."
    );

    return NextResponse.redirect(
      signUpUrl,
      { status: 303 }
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
      const signUpUrl = new URL(buildPathWithNext("/sign-up", nextPath), request.url);
      signUpUrl.searchParams.set(
        "error",
        "An account already exists with that email or handle."
      );

      return NextResponse.redirect(signUpUrl, {
        status: 303,
      });
    }

    throw error;
  }

  const sessionToken = await createSession(user.id);
  const response = NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303,
  });

  applySessionCookie(response, sessionToken);
  revalidatePath("/");

  return response;
}
