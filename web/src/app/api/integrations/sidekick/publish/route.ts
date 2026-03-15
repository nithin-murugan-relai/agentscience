import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getUniqueConstraintTargets, isUserFacingError } from "@/lib/errors";
import {
  authenticateIntegrationToken,
  upsertSidekickPaper,
} from "@/lib/papers";
import { getClientIp } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { sidekickPublishSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  const bearerToken = authorizationHeader?.startsWith("Bearer ")
    ? authorizationHeader.slice("Bearer ".length)
    : null;

  if (!bearerToken) {
    return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
  }

  const integrationUser = await authenticateIntegrationToken(bearerToken);

  if (!integrationUser) {
    return NextResponse.json({ error: "Invalid integration token." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    namespace: "sidekick-publish",
    key: `${integrationUser.id}:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many publish attempts. Try again later." },
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

  const payload = sidekickPublishSchema.safeParse(body);

  if (!payload.success) {
    return NextResponse.json(
      {
        error:
          payload.error.issues[0]?.message ??
          "Invalid Sidekick publish payload.",
      },
      { status: 400 }
    );
  }

  let paper;

  try {
    paper = await upsertSidekickPaper(payload.data);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const uniqueTargets = getUniqueConstraintTargets(error);
    if (uniqueTargets.includes("doi")) {
      return NextResponse.json(
        { error: "A paper with that DOI already exists." },
        { status: 409 }
      );
    }

    if (uniqueTargets.includes("externalId")) {
      return NextResponse.json(
        { error: "A paper with that externalId already exists." },
        { status: 409 }
      );
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath(`/papers/${paper?.slug}`);

  return NextResponse.json({
    slug: paper?.slug,
    publishedBy: integrationUser.handle,
  });
}
