import { paperAiAssessmentSchema, type PaperAiAssessment } from "@/lib/validation";
import { average, clamp, excerpt } from "@/lib/utils";

export interface CitationCounts {
  openalex?: number | null;
  semanticScholar?: number | null;
  internalSignal?: number | null;
}

interface LeaderboardPaper {
  paperId: string;
  title?: string | null;
  noveltyScore: number;
  evidenceScore: number;
  citations: CitationCounts;
  referenceCitations?: CitationCounts[];
}

interface InfluenceEdge {
  sourceId: string;
  targetId: string;
  kind: string;
  confidence?: number;
}

export interface RankingInputPaper {
  paperId: string;
  title: string;
  abstract: string;
  markdown: string;
  keywords: string[];
  authorIds: string[];
  referenceTargets: string[];
  reviewScores: Array<{
    novelty: number;
    rigor: number;
    clarity: number;
    reproducibility: number;
  }>;
  saveCount: number;
  ideaCount: number;
  aiAssessment?: PaperAiAssessment | null;
}

export interface RankingResult {
  paperId: string;
  humanScore: number;
  networkScore: number;
  aiScore: number;
  finalScore: number;
  reviewCount: number;
  saveCount: number;
  ideaCount: number;
  aiSummary: string;
  usedHeuristicAi: boolean;
}

const EDGE_WEIGHTS: Record<string, number> = {
  citation: 1,
  topic: 0.45,
  collaboration: 0.25,
  llm_inferred: 0.5,
};

function resolveCitationCount(citations: CitationCounts) {
  const values = [
    citations.openalex,
    citations.semanticScholar,
    citations.internalSignal,
  ]
    .filter((value): value is number => value != null)
    .map((value) => Math.max(0, Math.round(value)));

  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
}

function citationSignal(citationCount: number) {
  return clamp(Math.log1p(Math.max(0, citationCount)) / Math.log1p(500));
}

function buildPriors(papers: LeaderboardPaper[]) {
  const rawScores = Object.fromEntries(
    papers.map((paper) => {
      const direct = resolveCitationCount(paper.citations);
      const inherited =
        paper.referenceCitations?.reduce(
          (sum, citations) => sum + resolveCitationCount(citations),
          0
        ) ?? 0;
      const citationComponent = citationSignal(direct + inherited * 0.25);
      const prior =
        0.55 * citationComponent +
        0.25 * clamp(paper.evidenceScore) +
        0.2 * clamp(paper.noveltyScore);

      return [paper.paperId, prior];
    })
  );

  const total = Object.values(rawScores).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    const uniform = 1 / papers.length;
    return Object.fromEntries(papers.map((paper) => [paper.paperId, uniform]));
  }

  return Object.fromEntries(
    Object.entries(rawScores).map(([paperId, value]) => [paperId, value / total])
  );
}

function buildWeightedGraph(
  papers: LeaderboardPaper[],
  edges: InfluenceEdge[]
): Record<string, Record<string, number>> {
  const validIds = new Set(papers.map((paper) => paper.paperId));
  const graph: Record<string, Record<string, number>> = {};

  for (const paper of papers) {
    graph[paper.paperId] = {};
  }

  for (const edge of edges) {
    if (!validIds.has(edge.sourceId) || !validIds.has(edge.targetId)) {
      continue;
    }

    if (edge.sourceId === edge.targetId) {
      continue;
    }

    const baseWeight = EDGE_WEIGHTS[edge.kind] ?? EDGE_WEIGHTS.llm_inferred;
    const confidence = clamp(edge.confidence ?? 1);
    const resolvedWeight = Math.max(0.05, baseWeight * confidence);

    graph[edge.sourceId][edge.targetId] =
      (graph[edge.sourceId][edge.targetId] ?? 0) + resolvedWeight;
  }

  return graph;
}

function weightedPageRank(
  paperIds: string[],
  graph: Record<string, Record<string, number>>,
  priors: Record<string, number>
) {
  if (paperIds.length === 0) {
    return {};
  }

  let rank = Object.fromEntries(paperIds.map((paperId) => [paperId, 1 / paperIds.length]));

  for (let iteration = 0; iteration < 80; iteration += 1) {
    const nextRank = Object.fromEntries(
      paperIds.map((paperId) => [paperId, 0.15 * (priors[paperId] ?? 0)])
    );
    let sinkMass = 0;

    for (const sourceId of paperIds) {
      const outgoing = graph[sourceId] ?? {};
      const totalWeight = Object.values(outgoing).reduce((sum, value) => sum + value, 0);

      if (totalWeight === 0) {
        sinkMass += 0.85 * (rank[sourceId] ?? 0);
        continue;
      }

      for (const [targetId, weight] of Object.entries(outgoing)) {
        nextRank[targetId] += 0.85 * (rank[sourceId] ?? 0) * (weight / totalWeight);
      }
    }

    if (sinkMass > 0) {
      for (const paperId of paperIds) {
        nextRank[paperId] += sinkMass * (priors[paperId] ?? 0);
      }
    }

    const delta = paperIds.reduce(
      (sum, paperId) => sum + Math.abs(nextRank[paperId] - (rank[paperId] ?? 0)),
      0
    );

    rank = nextRank;

    if (delta < 1e-9) {
      break;
    }
  }

  const total = Object.values(rank).reduce((sum, value) => sum + value, 0);

  return Object.fromEntries(
    Object.entries(rank).map(([paperId, value]) => [paperId, total > 0 ? value / total : value])
  );
}

function wordDiversity(words: string[]) {
  return clamp(new Set(words).size / 10);
}

function sentenceLengthScore(text: string) {
  const sentences = text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (sentences.length === 0) {
    return 0.55;
  }

  const lengths = sentences.map((sentence) => sentence.split(/\s+/).length);
  const averageLength = average(lengths);

  return clamp(1 - Math.abs(averageLength - 22) / 22, 0.35, 1);
}

function hasStructuredSections(markdown: string) {
  const lowerCase = markdown.toLowerCase();
  const markers = ["# introduction", "# methods", "# results", "# discussion", "references"];
  return markers.filter((marker) => lowerCase.includes(marker)).length;
}

function heuristicAiAssessment(paper: RankingInputPaper): PaperAiAssessment {
  const markdown = paper.markdown.toLowerCase();
  const structure = clamp(hasStructuredSections(markdown) / 5);
  const methodsSignal = clamp(
    [
      markdown.includes("method"),
      markdown.includes("dataset"),
      markdown.includes("analysis"),
      markdown.includes("appendix"),
    ].filter(Boolean).length / 4
  );
  const clarity = sentenceLengthScore(paper.abstract);
  const novelty = clamp(0.35 + 0.35 * wordDiversity(paper.keywords) + 0.3 * clamp(paper.ideaCount / 4));
  const rigor = clamp(0.25 + 0.35 * structure + 0.4 * methodsSignal);
  const reproducibility = clamp(
    0.2 +
      0.45 * methodsSignal +
      0.2 * clamp(paper.referenceTargets.length / 6) +
      0.15 * clamp((paper.markdown.length - 600) / 3000)
  );
  const overall = clamp(0.2 * novelty + 0.3 * rigor + 0.25 * clarity + 0.25 * reproducibility);

  return paperAiAssessmentSchema.parse({
    summary: `Heuristic fallback based on structure, references, and writing completeness for “${paper.title}”.`,
    overall,
    novelty,
    rigor,
    clarity,
    reproducibility,
  });
}

function jaccardSimilarity(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;

  if (union === 0) {
    return 0;
  }

  return intersection / union;
}

function averageReviewScore(
  reviews: RankingInputPaper["reviewScores"],
  selector: (review: RankingInputPaper["reviewScores"][number]) => number
) {
  return average(reviews.map((review) => selector(review) / 5));
}

export function buildPaperRankings(papers: RankingInputPaper[]): RankingResult[] {
  if (papers.length === 0) {
    return [];
  }

  const internalSignalMap = Object.fromEntries(
    papers.map((paper) => [
      paper.paperId,
      paper.saveCount * 6 + paper.reviewScores.length * 12 + paper.ideaCount * 4,
    ])
  );

  const aiAssessmentMap = Object.fromEntries(
    papers.map((paper) => {
      const resolved = paper.aiAssessment ?? heuristicAiAssessment(paper);
      return [paper.paperId, resolved];
    })
  );

  const leaderboardInputs: LeaderboardPaper[] = papers.map((paper) => {
    const humanNovelty = averageReviewScore(paper.reviewScores, (review) => review.novelty);
    const humanEvidence = averageReviewScore(
      paper.reviewScores,
      (review) => (review.rigor + review.reproducibility) / 2
    );
    const aiAssessment = aiAssessmentMap[paper.paperId];

    return {
      paperId: paper.paperId,
      title: paper.title,
      noveltyScore: average([humanNovelty || aiAssessment.novelty, aiAssessment.novelty]),
      evidenceScore: average([humanEvidence || aiAssessment.rigor, aiAssessment.reproducibility]),
      citations: {
        internalSignal: internalSignalMap[paper.paperId],
      },
      referenceCitations: paper.referenceTargets.map((targetId) => ({
        internalSignal: internalSignalMap[targetId] ?? 0,
      })),
    };
  });

  const edges: InfluenceEdge[] = [];

  for (const paper of papers) {
    for (const targetId of paper.referenceTargets) {
      edges.push({
        sourceId: paper.paperId,
        targetId,
        kind: "citation",
        confidence: 1,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < papers.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < papers.length; rightIndex += 1) {
      const leftPaper = papers[leftIndex];
      const rightPaper = papers[rightIndex];
      const topicSimilarity = jaccardSimilarity(leftPaper.keywords, rightPaper.keywords);

      if (topicSimilarity >= 0.18) {
        edges.push({
          sourceId: leftPaper.paperId,
          targetId: rightPaper.paperId,
          kind: "topic",
          confidence: topicSimilarity,
        });
        edges.push({
          sourceId: rightPaper.paperId,
          targetId: leftPaper.paperId,
          kind: "topic",
          confidence: topicSimilarity,
        });
      }

      const sharedAuthors = leftPaper.authorIds.filter((authorId) =>
        rightPaper.authorIds.includes(authorId)
      ).length;

      if (sharedAuthors > 0) {
        const confidence = clamp(sharedAuthors / 3);

        edges.push({
          sourceId: leftPaper.paperId,
          targetId: rightPaper.paperId,
          kind: "collaboration",
          confidence,
        });
        edges.push({
          sourceId: rightPaper.paperId,
          targetId: leftPaper.paperId,
          kind: "collaboration",
          confidence,
        });
      }
    }
  }

  const priors = buildPriors(leaderboardInputs);
  const graph = buildWeightedGraph(leaderboardInputs, edges);
  const pagerank = weightedPageRank(
    leaderboardInputs.map((paper) => paper.paperId),
    graph,
    priors
  );
  const maxPageRank = Math.max(...Object.values(pagerank), 1);

  const results = papers.map((paper) => {
    const aiAssessment = aiAssessmentMap[paper.paperId];
    const humanQuality = paper.reviewScores.length
      ? average(
          paper.reviewScores.map((review) =>
            average([
              review.novelty / 5,
              review.rigor / 5,
              review.clarity / 5,
              review.reproducibility / 5,
            ])
          )
        )
      : aiAssessment.overall * 0.65;
    const networkScore = clamp((pagerank[paper.paperId] ?? 0) / maxPageRank);
    const aiScore = aiAssessment.overall;
    const finalScore = clamp(0.45 * humanQuality + 0.35 * networkScore + 0.2 * aiScore);

    return {
      paperId: paper.paperId,
      humanScore: Number(humanQuality.toFixed(6)),
      networkScore: Number(networkScore.toFixed(6)),
      aiScore: Number(aiScore.toFixed(6)),
      finalScore: Number(finalScore.toFixed(6)),
      reviewCount: paper.reviewScores.length,
      saveCount: paper.saveCount,
      ideaCount: paper.ideaCount,
      aiSummary: excerpt(aiAssessment.summary, 220),
      usedHeuristicAi: !paper.aiAssessment,
    } satisfies RankingResult;
  });

  results.sort((left, right) => right.finalScore - left.finalScore);
  return results;
}
