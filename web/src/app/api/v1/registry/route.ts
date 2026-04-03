import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/registry?q=<query>&limit=<n>
 *
 * Search the dataset registry. Public, no auth required.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

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

  const body = await request.json();

  if (!body.name || !body.url || !body.description) {
    return NextResponse.json(
      { error: "name, url, and description are required." },
      { status: 400 }
    );
  }

  const dataset = await prisma.datasetEntry.create({
    data: {
      name: body.name,
      url: body.url,
      domain: body.domain ?? new URL(body.url).hostname,
      description: body.description,
      keywords: Array.isArray(body.keywords) ? body.keywords : [],
      sourcePaperId: body.sourcePaperId ?? null,
      sourceRank: body.sourceRank ?? null,
      addedBy: user.id,
    },
  });

  return NextResponse.json({ dataset }, { status: 201 });
}
