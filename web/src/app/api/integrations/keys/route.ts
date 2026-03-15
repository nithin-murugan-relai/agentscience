import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isUserFacingError } from "@/lib/errors";
import { createIntegrationKey } from "@/lib/papers";
import { validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { integrationKeySchema } from "@/lib/validation";

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.json({ error: invalidOrigin }, { status: 403 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    namespace: "integration-key-create",
    key: user.id,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many token creation attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = integrationKeySchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      {
        error: payload.error.issues[0]?.message ?? "Invalid integration key payload.",
      },
      { status: 400 }
    );
  }

  let result;

  try {
    result = await createIntegrationKey(user.id, payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const { key, token } = result;

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
