import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  applySessionCookie,
  createSession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildPathWithNext,
  getClientIp,
  getSafeRedirectPath,
  validateBrowserOrigin,
} from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { toSearchParams } from "@/lib/utils";
import { signInSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/sign-in${toSearchParams({ error: invalidOrigin })}`, request.url),
      { status: 303 }
    );
  }

  const formData = await request.formData();
  const payload = signInSchema.safeParse(Object.fromEntries(formData));
  const nextPath = getSafeRedirectPath(formData.get("next") as string | null, "/");

  if (!payload.success) {
    const signInUrl = new URL(buildPathWithNext("/sign-in", nextPath), request.url);
    signInUrl.searchParams.set("error", "Enter a valid email and password.");

    return NextResponse.redirect(
      signInUrl,
      { status: 303 }
    );
  }

  const rateLimit = await checkRateLimit({
    namespace: "sign-in",
    key: `${getClientIp(request)}:${payload.data.email}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    const signInUrl = new URL(buildPathWithNext("/sign-in", nextPath), request.url);
    signInUrl.searchParams.set("error", "Too many sign-in attempts. Try again later.");

    return NextResponse.redirect(signInUrl, {
      status: 303,
      headers: {
        "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      email: payload.data.email,
    },
  });

  if (!user || !(await verifyPassword(payload.data.password, user.passwordHash))) {
    const signInUrl = new URL(buildPathWithNext("/sign-in", nextPath), request.url);
    signInUrl.searchParams.set("error", "Email or password is incorrect.");

    return NextResponse.redirect(
      signInUrl,
      { status: 303 }
    );
  }

  const sessionToken = await createSession(user.id);
  const response = NextResponse.redirect(new URL(nextPath, request.url), {
    status: 303,
  });

  applySessionCookie(response, sessionToken);
  revalidatePath("/");

  return response;
}
