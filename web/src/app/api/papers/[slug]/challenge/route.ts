import { NextResponse } from "next/server";

import { isUserFacingError } from "@/lib/errors";
import { createSidekickService } from "@/lib/sidekick/service";
import { sidekickChallengeSchema } from "@/lib/sidekick/validation";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteProps) {
  const body = sidekickChallengeSchema.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid challenge payload." },
      { status: 400 }
    );
  }

  try {
    const { slug } = await params;
    const result = await createSidekickService().registerChallenge(slug, body.data);
    return NextResponse.json(result);
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
