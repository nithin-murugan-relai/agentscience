import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  clearSessionCookie,
  hashToken,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateBrowserOrigin } from "@/lib/request";

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(new URL("/", request.url), {
      status: 303,
    });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: {
        tokenHash: hashToken(token),
      },
    });
  }

  const response = NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });
  clearSessionCookie(response);
  revalidatePath("/");

  return response;
}
