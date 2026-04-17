import { NextResponse } from "next/server";

import {
  checkDatasetRegistryCandidate,
  datasetRegistryCheckRequestSchema,
} from "@/lib/dataset-registry";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/registry/check
 *
 * Check whether proposed dataset registry entries are already present, likely
 * duplicates, or clearly new.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = datasetRegistryCheckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid dataset registry check payload." },
      { status: 400 },
    );
  }

  const datasets = await Promise.all(
    parsed.data.datasets.map((dataset) => checkDatasetRegistryCandidate(dataset)),
  );

  return NextResponse.json({ datasets });
}
