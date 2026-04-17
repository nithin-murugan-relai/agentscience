import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { getDatasetRegistry } from "@/lib/datasets";
import {
  createDatasetRegistryEntry,
  datasetRegistryCandidateSchema,
} from "@/lib/dataset-registry";
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
  const limit = parsePositiveInt(url.searchParams.get("limit"), 20, 500);
  const datasets = (await getDatasetRegistry({ query, limit })).map((dataset) => ({
    ...dataset,
    sourcePaper: dataset.sourcePaper
      ? {
          ...dataset.sourcePaper,
          url: new URL(dataset.sourcePaper.url, url).toString(),
        }
      : null,
  }));

  return NextResponse.json({ datasets });
}

/**
 * POST /api/v1/registry
 *
 * Add a dataset to the registry. Requires auth.
 *
 * Body: { name, shortName?, url, description, keywords?, providerSlug?, sourcePaperId?, sourceRank? }
 * If providerSlug is omitted, the dataset auto-links to the provider matching
 * its URL domain (creating a stub provider row if none exists).
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
