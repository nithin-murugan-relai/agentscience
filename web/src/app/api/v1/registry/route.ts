import { NextResponse } from "next/server";
import { z } from "zod";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { parsePositiveInt } from "@/lib/public-api";

export const dynamic = "force-dynamic";

const registryDatasetInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    }, "url must use http or https."),
  description: z.string().trim().min(12).max(2000),
  keywords: z.array(z.string().trim().min(1).max(60)).max(16).default([]),
  sourcePaperId: z.string().trim().min(1).max(64).optional().nullable(),
  sourceRank: z.coerce.number().finite().optional().nullable(),
});

function normalizeDomainFromUrl(value: string) {
  return new URL(value).hostname.replace(/^www\./i, "");
}

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
 * Body: { name, url, domain, description, keywords?, sourcePaperId?, sourceRank? }
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

  const keywords = [...new Set(parsed.data.keywords.map((keyword) => keyword.toLowerCase()))];

  const dataset = await prisma.datasetEntry.create({
    data: {
      name: parsed.data.name,
      url: parsed.data.url,
      domain: normalizeDomainFromUrl(parsed.data.url),
      description: parsed.data.description,
      keywords,
      sourcePaperId: parsed.data.sourcePaperId ?? null,
      sourceRank: parsed.data.sourceRank ?? null,
      addedBy: user.id,
    },
  });

  return NextResponse.json({ dataset }, { status: 201 });
}
