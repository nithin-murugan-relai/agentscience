import { prisma } from "@/lib/prisma";
import type { DatasetAreaKey } from "@/lib/topics";

export const INTERDISCIPLINARY_TOPIC_SLUG = "interdisciplinary";

const STRONG_TOPIC_SCORE_THRESHOLD = 4;
const WEAK_TOPIC_SCORE_THRESHOLD = 3;
const MAX_INFERRED_TOPICS = 4;

interface PhraseRule {
  phrase: string;
  weight: number;
}

export interface InferableDatasetTopic {
  id: string;
  slug: string;
  name: string;
  area: DatasetAreaKey;
  description: string | null;
  agentInstructions: string | null;
}

export interface DatasetTopicInferenceInput {
  name: string;
  shortName?: string | null;
  description: string;
  keywords: string[];
  domain?: string | null;
  providerName?: string | null;
  providerTopicSlugs?: string[];
  providerIsCanonical?: boolean;
  sourcePaperTitle?: string | null;
  sourcePaperAbstract?: string | null;
  sourcePaperKeywords?: string[];
}

const STOP_WORDS = new Set([
  "and",
  "data",
  "dataset",
  "for",
  "from",
  "into",
  "its",
  "of",
  "other",
  "study",
  "the",
  "their",
  "this",
  "with",
]);

const TOPIC_SIGNAL_RULES: Record<string, PhraseRule[]> = {
  benchmarks: [
    { phrase: "benchmark", weight: 4 },
    { phrase: "competition", weight: 3 },
    { phrase: "challenge", weight: 3 },
    { phrase: "leaderboard", weight: 4 },
    { phrase: "baseline", weight: 2 },
  ],
  climate: [
    { phrase: "climate", weight: 5 },
    { phrase: "temperature", weight: 3 },
    { phrase: "heat", weight: 2 },
    { phrase: "weather", weight: 3 },
  ],
  "clinical-records": [
    { phrase: "clinical", weight: 3 },
    { phrase: "patient", weight: 3 },
    { phrase: "cohort", weight: 2 },
    { phrase: "diagnosis", weight: 2 },
    { phrase: "relapse", weight: 2 },
    { phrase: "survival", weight: 2 },
    { phrase: "hospital", weight: 3 },
  ],
  "computer-vision": [
    { phrase: "computer vision", weight: 5 },
    { phrase: "image", weight: 2 },
    { phrase: "video", weight: 2 },
    { phrase: "segmentation", weight: 3 },
    { phrase: "detection", weight: 3 },
    { phrase: "recognition", weight: 2 },
  ],
  economics: [
    { phrase: "economics", weight: 5 },
    { phrase: "world bank", weight: 4 },
    { phrase: "gdp", weight: 5 },
    { phrase: "income", weight: 3 },
    { phrase: "market", weight: 2 },
    { phrase: "telecommunications", weight: 4 },
    { phrase: "broadband", weight: 3 },
    { phrase: "subscriptions", weight: 2 },
    { phrase: "infrastructure", weight: 2 },
    { phrase: "country panel", weight: 3 },
    { phrase: "comparative panel", weight: 2 },
  ],
  genomics: [
    { phrase: "genomics", weight: 5 },
    { phrase: "genomic", weight: 4 },
    { phrase: "genome", weight: 3 },
    { phrase: "sequencing", weight: 3 },
    { phrase: "whole genome", weight: 4 },
    { phrase: "whole exome", weight: 4 },
    { phrase: "copy number", weight: 3 },
    { phrase: "mutation", weight: 3 },
    { phrase: "methylation", weight: 3 },
    { phrase: "tcga", weight: 2 },
    { phrase: "cbioportal", weight: 2 },
    { phrase: "depmap", weight: 4 },
    { phrase: "crispr", weight: 2 },
  ],
  "machine-learning": [
    { phrase: "machine learning", weight: 5 },
    { phrase: "deep learning", weight: 4 },
    { phrase: "benchmark", weight: 2 },
    { phrase: "evaluation", weight: 2 },
    { phrase: "training", weight: 1 },
    { phrase: "model", weight: 1 },
  ],
  "medical-imaging": [
    { phrase: "medical imaging", weight: 5 },
    { phrase: "radiology", weight: 4 },
    { phrase: "ct", weight: 3 },
    { phrase: "mri", weight: 2 },
    { phrase: "pet", weight: 2 },
    { phrase: "pathology image", weight: 4 },
  ],
  neuroimaging: [
    { phrase: "neuroimaging", weight: 5 },
    { phrase: "mri", weight: 4 },
    { phrase: "fmri", weight: 4 },
    { phrase: "meg", weight: 4 },
    { phrase: "pet", weight: 3 },
    { phrase: "eeg", weight: 3 },
    { phrase: "ieeg", weight: 4 },
    { phrase: "hfo", weight: 2 },
  ],
  neuroscience: [
    { phrase: "neuroscience", weight: 5 },
    { phrase: "epilepsy", weight: 4 },
    { phrase: "seizure", weight: 4 },
    { phrase: "brain", weight: 3 },
    { phrase: "neural", weight: 3 },
    { phrase: "eeg", weight: 3 },
    { phrase: "ieeg", weight: 4 },
    { phrase: "glioblastoma", weight: 2 },
  ],
  "natural-language-processing": [
    { phrase: "natural language", weight: 5 },
    { phrase: "question answering", weight: 4 },
    { phrase: "language model", weight: 3 },
    { phrase: "qa", weight: 2 },
    { phrase: "corpus", weight: 2 },
    { phrase: "text", weight: 1 },
  ],
  pharmacology: [
    { phrase: "pharmacology", weight: 5 },
    { phrase: "drug screen", weight: 5 },
    { phrase: "drug", weight: 2 },
    { phrase: "repurposing", weight: 4 },
    { phrase: "compound", weight: 3 },
    { phrase: "therapeutic", weight: 2 },
    { phrase: "screen", weight: 2 },
    { phrase: "vulnerability", weight: 2 },
  ],
  "political-science": [
    { phrase: "policy", weight: 2 },
    { phrase: "regulation", weight: 3 },
    { phrase: "governance", weight: 3 },
    { phrase: "government", weight: 2 },
    { phrase: "election", weight: 5 },
    { phrase: "peer countries", weight: 2 },
  ],
  "public-health": [
    { phrase: "public health", weight: 5 },
    { phrase: "health disparities", weight: 5 },
    { phrase: "national survey", weight: 4 },
    { phrase: "survey", weight: 2 },
    { phrase: "population", weight: 2 },
    { phrase: "smoking", weight: 3 },
    { phrase: "epidemiology", weight: 4 },
    { phrase: "burden", weight: 2 },
  ],
  "remote-sensing": [
    { phrase: "remote sensing", weight: 5 },
    { phrase: "satellite", weight: 4 },
    { phrase: "imagery", weight: 3 },
  ],
  statistics: [
    { phrase: "statistics", weight: 5 },
    { phrase: "statistical", weight: 4 },
    { phrase: "inference", weight: 3 },
    { phrase: "probability", weight: 4 },
    { phrase: "causal", weight: 2 },
  ],
  transcriptomics: [
    { phrase: "transcriptomics", weight: 5 },
    { phrase: "rna seq", weight: 5 },
    { phrase: "expression", weight: 2 },
    { phrase: "gene expression", weight: 4 },
    { phrase: "microarray", weight: 4 },
    { phrase: "single cell", weight: 3 },
    { phrase: "geo", weight: 2 },
  ],
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomainTokens(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}$/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return value
    .split(" ")
    .map((token) =>
      token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token,
    )
    .filter((token) => token.length > 0);
}

function buildCorpusText(input: DatasetTopicInferenceInput) {
  return [
    input.name,
    input.shortName ?? "",
    input.description,
    input.providerName ?? "",
    normalizeDomainTokens(input.domain),
    ...input.keywords,
    input.sourcePaperTitle ?? "",
    input.sourcePaperAbstract ?? "",
    ...(input.sourcePaperKeywords ?? []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(" ");
}

function buildTopicRules(topic: InferableDatasetTopic) {
  const rules = new Map<string, number>();

  const addRule = (phrase: string, weight: number) => {
    const normalized = normalizeText(phrase);
    if (!normalized || STOP_WORDS.has(normalized)) {
      return;
    }
    rules.set(normalized, Math.max(rules.get(normalized) ?? 0, weight));
  };

  addRule(topic.name, 4);
  addRule(topic.slug.replace(/-/g, " "), 4);

  for (const token of tokenize(normalizeText(topic.name))) {
    if (token.length >= 4 && !STOP_WORDS.has(token)) {
      addRule(token, 1);
    }
  }
  for (const token of tokenize(normalizeText(topic.slug.replace(/-/g, " ")))) {
    if (token.length >= 4 && !STOP_WORDS.has(token)) {
      addRule(token, 1);
    }
  }
  for (const rule of TOPIC_SIGNAL_RULES[topic.slug] ?? []) {
    addRule(rule.phrase, rule.weight);
  }

  return [...rules.entries()].map(([phrase, weight]) => ({ phrase, weight }));
}

function hasPhraseMatch(corpus: string, phrase: string) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) {
    return false;
  }
  return ` ${corpus} `.includes(` ${normalizedPhrase} `);
}

function uniqueTopicSlugs(values: string[]) {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function scoreTopic(input: {
  topic: InferableDatasetTopic;
  corpus: string;
  providerTopicSlugs: Set<string>;
  providerIsCanonical: boolean;
}) {
  let score = 0;
  for (const rule of buildTopicRules(input.topic)) {
    if (hasPhraseMatch(input.corpus, rule.phrase)) {
      score += rule.weight;
    }
  }

  if (input.providerTopicSlugs.has(input.topic.slug)) {
    score += input.providerIsCanonical ? 2 : input.topic.slug === INTERDISCIPLINARY_TOPIC_SLUG ? 0 : 1;
  }

  return score;
}

export function inferDatasetTopicSlugs(
  input: DatasetTopicInferenceInput,
  topics: InferableDatasetTopic[],
) {
  const corpus = buildCorpusText(input);
  const providerTopicSlugs = new Set(uniqueTopicSlugs(input.providerTopicSlugs ?? []));
  const scored = topics
    .map((topic) => ({
      topic,
      score: scoreTopic({
        topic,
        corpus,
        providerTopicSlugs,
        providerIsCanonical: input.providerIsCanonical ?? false,
      }),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.topic.name.localeCompare(right.topic.name);
    });

  const strongMatches = uniqueTopicSlugs(
    scored
      .filter(
        ({ topic, score }) =>
          topic.slug !== INTERDISCIPLINARY_TOPIC_SLUG &&
          score >= STRONG_TOPIC_SCORE_THRESHOLD,
      )
      .map(({ topic }) => topic.slug),
  ).slice(0, MAX_INFERRED_TOPICS);
  if (strongMatches.length > 0) {
    return strongMatches;
  }

  const weakMatches = uniqueTopicSlugs(
    scored
      .filter(
        ({ topic, score }) =>
          topic.slug !== INTERDISCIPLINARY_TOPIC_SLUG &&
          score >= WEAK_TOPIC_SCORE_THRESHOLD,
      )
      .map(({ topic }) => topic.slug),
  ).slice(0, 2);
  if (weakMatches.length > 0) {
    return weakMatches;
  }

  const providerSpecificTopics = uniqueTopicSlugs(
    [...providerTopicSlugs].filter((slug) => slug !== INTERDISCIPLINARY_TOPIC_SLUG),
  ).slice(0, MAX_INFERRED_TOPICS);
  if (providerSpecificTopics.length > 0) {
    return providerSpecificTopics;
  }

  if (topics.some((topic) => topic.slug === INTERDISCIPLINARY_TOPIC_SLUG)) {
    return [INTERDISCIPLINARY_TOPIC_SLUG];
  }

  return [];
}

export async function inferDatasetTopicIdsForCandidate(input: {
  name: string;
  shortName?: string | null;
  description: string;
  keywords: string[];
  domain?: string | null;
  providerId?: string | null;
  sourcePaperId?: string | null;
}) {
  const [topics, provider, paper] = await Promise.all([
    prisma.datasetTopic.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        slug: true,
        name: true,
        area: true,
        description: true,
        agentInstructions: true,
      },
      orderBy: [{ area: "asc" }, { name: "asc" }],
    }),
    input.providerId
      ? prisma.datasetProvider.findUnique({
          where: { id: input.providerId },
          select: {
            name: true,
            searchKind: true,
            searchEndpoint: true,
            searchQueryTemplate: true,
            datasetUrlTemplate: true,
            agentInstructions: true,
            topics: {
              where: { status: "ACTIVE" },
              select: { slug: true },
            },
          },
        })
      : Promise.resolve(null),
    input.sourcePaperId
      ? prisma.paper.findUnique({
          where: { id: input.sourcePaperId },
          select: {
            title: true,
            abstract: true,
            keywords: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const slugs = inferDatasetTopicSlugs(
    {
      name: input.name,
      shortName: input.shortName ?? null,
      description: input.description,
      keywords: input.keywords,
      domain: input.domain ?? null,
      providerName: provider?.name ?? null,
      providerTopicSlugs: provider?.topics.map((topic) => topic.slug) ?? [],
      providerIsCanonical: Boolean(
        provider?.searchKind ||
          provider?.searchEndpoint ||
          provider?.searchQueryTemplate ||
          provider?.datasetUrlTemplate ||
          provider?.agentInstructions,
      ),
      sourcePaperTitle: paper?.title ?? null,
      sourcePaperAbstract: paper?.abstract ?? null,
      sourcePaperKeywords: paper?.keywords ?? [],
    },
    topics,
  );

  const topicIdBySlug = new Map(topics.map((topic) => [topic.slug, topic.id]));
  return slugs.flatMap((slug) => {
    const id = topicIdBySlug.get(slug);
    return id ? [id] : [];
  });
}
