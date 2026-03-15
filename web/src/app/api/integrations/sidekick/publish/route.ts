import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  authenticateIntegrationToken,
  upsertSidekickPaper,
} from "@/lib/papers";
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

  const body = await request.json();
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

  const paper = await upsertSidekickPaper(payload.data);

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath(`/papers/${paper?.slug}`);

  return NextResponse.json({
    slug: paper?.slug,
    publishedBy: integrationUser.handle,
  });
}
