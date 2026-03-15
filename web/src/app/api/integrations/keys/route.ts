import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createIntegrationKey } from "@/lib/papers";
import { integrationKeySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = await request.json();
  const payload = integrationKeySchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      {
        error: payload.error.issues[0]?.message ?? "Invalid integration key payload.",
      },
      { status: 400 }
    );
  }

  const { key, token } = await createIntegrationKey(user.id, payload.data);

  return NextResponse.json({
    id: key.id,
    token,
    key: {
      id: key.id,
      name: key.name,
      tokenPrefix: key.tokenPrefix,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    },
  });
}
