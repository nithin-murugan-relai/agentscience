import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import {
  createDatasetRegistryEntry,
  datasetRegistryCandidateSchema,
} from "@/lib/dataset-registry";
import { prisma } from "@/lib/prisma";
import { parsePositiveInt } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const registryDatasetInputSchema = datasetRegistryCandidateSchema.extend({
  sourcePaperId: z.string().trim().min(1).max(64).optional().nullable(),
  sourceRank: z.coerce.number().finite().optional().nullable(),
});

/**
 * GET /api/v1/registry?q=<query>&limit=<n>
 *
 * Search the dataset registry. Public, no auth required.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20, 100);

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { description: { contains: query, mode: "insensitive" as const } },
          { domain: { contains: query, mode: "insensitive" as const } },
          { keywords: { hasSome: query.toLowerCase().split(/\s+/) } },
        ],
      }
    : {};

  const datasets = await prisma.datasetEntry.findMany({
    where,
    orderBy: [{ sourceRank: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({ datasets });
}

/**
 * POST /api/v1/registry
 *
 * Add a dataset to the registry. Requires auth.
 *
 * Body: { name, url, description, keywords?, sourcePaperId?, sourceRank? }
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
      { status: 400 }
    );
  }

  const parsed = registryDatasetInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid dataset registry payload." },
      { status: 400 }
    );
  }

  const result = await createDatasetRegistryEntry({
    userId: user.id,
    dataset: parsed.data,
    sourcePaperId: parsed.data.sourcePaperId ?? null,
    sourceRank: parsed.data.sourceRank ?? null,
  });

  return NextResponse.json(
    {
      dataset: result.dataset,
      created: result.created,
      duplicateStatus: result.duplicateStatus,
      check: result.check,
    },
    { status: result.created ? 201 : 200 },
  );
}
