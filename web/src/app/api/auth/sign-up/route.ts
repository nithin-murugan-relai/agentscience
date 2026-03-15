import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { applySessionCookie, createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toSearchParams } from "@/lib/utils";
import { signUpSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = signUpSchema.safeParse(Object.fromEntries(formData));

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `/sign-up${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid sign-up form.",
        })}`,
        request.url
      ),
      { status: 303 }
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
    return NextResponse.redirect(
      new URL(
        `/sign-up${toSearchParams({
          error: "An account already exists with that email or handle.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  const { password, ...userFields } = payload.data;
  const user = await prisma.user.create({
    data: {
      ...userFields,
      passwordHash: await hashPassword(password),
    },
  });

  const sessionToken = await createSession(user.id);
  const response = NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });

  applySessionCookie(response, sessionToken);
  revalidatePath("/");

  return response;
}
