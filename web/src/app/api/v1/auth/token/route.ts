import { NextResponse } from "next/server";

import { createIntegrationKey } from "@/lib/papers";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { apiTokenSignInSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = apiTokenSignInSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid sign-in payload." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email: payload.data.email,
    },
  });

  if (!user || !(await verifyPassword(payload.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const result = await createIntegrationKey(user.id, { name: payload.data.name });

  return NextResponse.json({
    token: result.token,
    tokenPrefix: result.key.tokenPrefix,
    user: {
      id: user.id,
      name: user.name,
      handle: user.handle,
      email: user.email,
    },
  });
}
