import { prisma } from "@/lib/prisma";
import {
  inferDatasetTopicIdsForCandidate,
  INTERDISCIPLINARY_TOPIC_SLUG,
} from "@/lib/dataset-topic-inference";

function parseLimit(args: string[]) {
  const index = args.indexOf("--limit");
  if (index < 0) {
    return undefined;
  }

  const raw = args[index + 1];
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function sorted(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const processAll = args.includes("--all");
  const limit = parseLimit(args);

  const datasets = await prisma.datasetEntry.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      provider: {
        select: {
          name: true,
          domain: true,
        },
      },
      topics: {
        select: {
          id: true,
          slug: true,
          status: true,
        },
        orderBy: [{ slug: "asc" }],
      },
    },
  });

  let scanned = 0;
  let proposed = 0;
  let updated = 0;

  for (const dataset of datasets) {
    const activeTopicSlugs = sorted(
      dataset.topics
        .filter((topic) => topic.status === "ACTIVE")
        .map((topic) => topic.slug),
    );
    const shouldProcess =
      processAll ||
      activeTopicSlugs.length === 0 ||
      (activeTopicSlugs.length === 1 &&
        activeTopicSlugs[0] === INTERDISCIPLINARY_TOPIC_SLUG);

    if (!shouldProcess) {
      continue;
    }

    scanned += 1;

    const inferredTopicIds = await inferDatasetTopicIdsForCandidate({
      name: dataset.name,
      shortName: dataset.shortName,
      description: dataset.description,
      keywords: dataset.keywords,
      domain: dataset.domain,
      providerId: dataset.providerId,
      sourcePaperId: dataset.sourcePaperId,
    });

    const pendingTopicIds = dataset.topics
      .filter((topic) => topic.status === "PENDING")
      .map((topic) => topic.id);
    const nextTopicIds = sorted([...new Set([...pendingTopicIds, ...inferredTopicIds])]);
    const currentTopicIds = sorted(dataset.topics.map((topic) => topic.id));

    if (nextTopicIds.length === 0 || nextTopicIds.join(",") === currentTopicIds.join(",")) {
      continue;
    }

    proposed += 1;
    const nextTopicSlugs = await prisma.datasetTopic.findMany({
      where: { id: { in: nextTopicIds } },
      select: { slug: true },
      orderBy: [{ slug: "asc" }],
    });

    console.log(
      [
        `${write ? "UPDATE" : "PLAN"} ${dataset.name}`,
        `  provider: ${dataset.provider?.name ?? dataset.domain}`,
        `  current: ${activeTopicSlugs.join(", ") || "(none)"}`,
        `  next: ${nextTopicSlugs.map((topic) => topic.slug).join(", ") || "(none)"}`,
      ].join("\n"),
    );

    if (!write) {
      continue;
    }

    await prisma.datasetEntry.update({
      where: { id: dataset.id },
      data: {
        topics: {
          set: nextTopicIds.map((id) => ({ id })),
        },
      },
    });
    updated += 1;
  }

  console.log(
    [
      `Scanned ${scanned} candidate ${scanned === 1 ? "dataset" : "datasets"}.`,
      `${proposed} ${proposed === 1 ? "change" : "changes"} proposed.`,
      write ? `${updated} ${updated === 1 ? "dataset" : "datasets"} updated.` : "Dry run only. Re-run with --write to persist changes.",
    ].join(" "),
  );
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
