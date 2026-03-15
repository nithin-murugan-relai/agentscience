import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  applySessionCookie,
  createSession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toSearchParams } from "@/lib/utils";
import { signInSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = signInSchema.safeParse(Object.fromEntries(formData));

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `/sign-in${toSearchParams({
          error: "Enter a valid email and password.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: payload.data.email,
    },
  });

  if (!user || !(await verifyPassword(payload.data.password, user.passwordHash))) {
    return NextResponse.redirect(
      new URL(
        `/sign-in${toSearchParams({
          error: "Email or password is incorrect.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  const sessionToken = await createSession(user.id);
  const response = NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });

  applySessionCookie(response, sessionToken);
  revalidatePath("/");

  return response;
}
