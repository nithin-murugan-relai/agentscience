import { paperAiAssessmentSchema, type PaperAiAssessment } from "@/lib/validation";
import { average, clamp, excerpt } from "@/lib/utils";

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
    verdict: "ENDORSE" | "CONCERN";
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
  integrityScore: number;
  finalScore: number;
  reviewCount: number;
  saveCount: number;
  ideaCount: number;
  aiSummary: string;
  integritySummary: string;
  usedHeuristicAi: boolean;
}

function normalizeLog(value: number, maxValue: number) {
  if (maxValue <= 0) {
    return 0;
  }

  return clamp(Math.log1p(Math.max(0, value)) / Math.log1p(maxValue));
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
  const claimVerification = clamp(0.3 + 0.45 * methodsSignal + 0.25 * structure);
  const referenceIntegrity = clamp(
    0.2 + 0.55 * clamp(paper.referenceTargets.length / 6) + 0.25 * structure
  );
  const methodologicalCoherence = clamp(0.3 + 0.45 * structure + 0.25 * methodsSignal);
  const hallucinationResistance = clamp(
    0.25 +
      0.35 * structure +
      0.25 * methodsSignal +
      0.15 * clamp((paper.markdown.length - 800) / 3200)
  );
  const integrityScore = clamp(
    0.3 * claimVerification +
      0.25 * referenceIntegrity +
      0.25 * methodologicalCoherence +
      0.2 * hallucinationResistance
  );
  const overall = clamp(0.2 * novelty + 0.3 * rigor + 0.25 * clarity + 0.25 * reproducibility);
  const summary = [
    `Heuristic fallback for "${paper.title}" because no model-generated assessment is available yet.`,
    `The estimate blends section structure, abstract clarity, keyword diversity, reference coverage, idea activity, and method-language density to approximate how complete the manuscript looks before formal AI review runs.`,
    `Structure contributes ${structure.toFixed(2)} from the presence of canonical scientific sections, while methods and analysis language contributes ${methodsSignal.toFixed(2)} by rewarding concrete implementation detail rather than vague framing alone.`,
    `The abstract readability score is ${clarity.toFixed(2)}, novelty is ${novelty.toFixed(2)} based on topic diversity and ideation signal, rigor is ${rigor.toFixed(2)}, and reproducibility is ${reproducibility.toFixed(2)} from references plus implementation depth.`,
    `This fallback is intentionally conservative and should be treated as a temporary ranking input, not a substitute for either peer review or a full LLM assessment.`,
  ].join(" ");
  const integritySummary = [
    `Integrity stress-test fallback for "${paper.title}" because no model-generated assessment is available yet.`,
    `Claim support is estimated at ${claimVerification.toFixed(2)}, reference integrity at ${referenceIntegrity.toFixed(2)}, methodological coherence at ${methodologicalCoherence.toFixed(2)}, and hallucination resistance at ${hallucinationResistance.toFixed(2)}.`,
    `This signal only checks for structural evidence that the draft looks grounded; it is a conservative placeholder until a real automated review runs.`,
  ].join(" ");

  return paperAiAssessmentSchema.parse({
    summary,
    overall,
    novelty,
    rigor,
    clarity,
    reproducibility,
    integrityScore,
    integritySummary,
    claimVerification,
    referenceIntegrity,
    methodologicalCoherence,
    hallucinationResistance,
  });
}

function buildInboundCitationCounts(papers: RankingInputPaper[]) {
  const counts = Object.fromEntries(papers.map((paper) => [paper.paperId, 0]));

  for (const paper of papers) {
    for (const targetId of paper.referenceTargets) {
      if (targetId in counts) {
        counts[targetId] += 1;
      }
    }
  }

  return counts;
}

export function buildPaperRankings(papers: RankingInputPaper[]): RankingResult[] {
  if (papers.length === 0) {
    return [];
  }

  const aiAssessmentMap = Object.fromEntries(
    papers.map((paper) => {
      const resolved = paper.aiAssessment ?? heuristicAiAssessment(paper);
      return [paper.paperId, resolved];
    })
  );
  const inboundCitations = buildInboundCitationCounts(papers);
  const maxInboundCitations = Math.max(...Object.values(inboundCitations), 1);
  const maxSaveCount = Math.max(...papers.map((paper) => paper.saveCount), 1);
  const maxReviewCount = Math.max(...papers.map((paper) => paper.reviewScores.length), 1);
  const maxIdeaCount = Math.max(...papers.map((paper) => paper.ideaCount), 1);

  const results = papers.map((paper) => {
    const aiAssessment = aiAssessmentMap[paper.paperId];
    const reviewCount = paper.reviewScores.length;
    const reviewDimensionAverage = reviewCount
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
      : 0;
    const verdictSignal = reviewCount
      ? average(
          paper.reviewScores.map((review) =>
            review.verdict === "ENDORSE" ? 1 : 0.35
          )
        )
      : 0;
    const humanScore = reviewCount
      ? clamp(0.85 * reviewDimensionAverage + 0.15 * verdictSignal)
      : 0;
    const citationScore = normalizeLog(inboundCitations[paper.paperId] ?? 0, maxInboundCitations);
    const saveScore = normalizeLog(paper.saveCount, maxSaveCount);
    const reviewSignalScore = normalizeLog(reviewCount, maxReviewCount);
    const ideaScore = normalizeLog(paper.ideaCount, maxIdeaCount);
    const networkScore = clamp(
      0.45 * citationScore +
        0.3 * saveScore +
        0.2 * reviewSignalScore +
        0.05 * ideaScore
    );
    const aiScore = clamp(0.75 * aiAssessment.overall + 0.25 * aiAssessment.integrityScore);
    const integrityScore = aiAssessment.integrityScore;
    const qualityScore = reviewCount
      ? clamp(0.8 * humanScore + 0.15 * aiAssessment.overall + 0.05 * integrityScore)
      : paper.aiAssessment
        ? clamp(0.8 * aiAssessment.overall + 0.2 * integrityScore)
        : clamp(Math.min(0.45 * aiAssessment.overall + 0.1 * integrityScore, 0.45));
    const finalScore = clamp(0.78 * qualityScore + 0.22 * networkScore);

    return {
      paperId: paper.paperId,
      humanScore: Number(humanScore.toFixed(6)),
      networkScore: Number(networkScore.toFixed(6)),
      aiScore: Number(aiScore.toFixed(6)),
      integrityScore: Number(integrityScore.toFixed(6)),
      finalScore: Number(finalScore.toFixed(6)),
      reviewCount,
      saveCount: paper.saveCount,
      ideaCount: paper.ideaCount,
      aiSummary: excerpt(aiAssessment.summary, 220),
      integritySummary: excerpt(aiAssessment.integritySummary, 220),
      usedHeuristicAi: !paper.aiAssessment,
    } satisfies RankingResult;
  });

  results.sort((left, right) => {
    if (right.finalScore !== left.finalScore) {
      return right.finalScore - left.finalScore;
    }

    if (right.reviewCount !== left.reviewCount) {
      return right.reviewCount - left.reviewCount;
    }

    return right.networkScore - left.networkScore;
  });

  return results;
}
