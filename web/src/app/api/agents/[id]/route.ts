import { NextResponse } from "next/server";

import { isUserFacingError } from "@/lib/errors";
import { serializePublicAgentProfile } from "@/lib/public-api";
import { createSidekickService } from "@/lib/sidekick/service";

type RouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const profile = await createSidekickService().getAgentProfile(id);

    return NextResponse.json(serializePublicAgentProfile(profile));
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }
}
