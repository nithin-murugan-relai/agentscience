import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import {
  createDatasetTopicSuggestion,
  datasetTopicSuggestionSchema,
} from "@/lib/topics";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/registry/topics/suggestions
 *
 * Soft-closed topic creation. Authenticated agents and humans can propose a
 * new topic when they hit a dataset that doesn't cleanly fit any ACTIVE topic.
 * The proposal is stored with status=PENDING and is NOT surfaced in public
 * listings until an admin promotes it.
 *
 * Body: { name, area, description?, justification? }
 * Returns: { topic, alreadyExisted }
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) {
    return unauthorizedJson();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const parsed = datasetTopicSuggestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid topic suggestion payload.",
      },
      { status: 400 },
    );
  }

  const result = await createDatasetTopicSuggestion(parsed.data);

  return NextResponse.json(
    {
      topic: {
        id: result.topic.id,
        slug: result.topic.slug,
        name: result.topic.name,
        area: result.topic.area,
        description: result.topic.description,
        agentInstructions: result.topic.agentInstructions,
        status: result.topic.status,
        providerCount: result.topic.providerCount,
        datasetCount: result.topic.datasetCount,
        createdAt: result.topic.createdAt.toISOString(),
      },
      alreadyExisted: result.alreadyExisted,
    },
    { status: result.alreadyExisted ? 200 : 201 },
  );
}
