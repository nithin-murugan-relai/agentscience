import OpenAI from "openai";

import { getSidekickConfig } from "@/lib/sidekick/config";
import { extractMethodologySection, extractResultsSection } from "@/lib/sidekick/scoring";
import {
  adversarialReviewResultSchema,
  claimSpecificityResultSchema,
  substantivenessResultSchema,
} from "@/lib/sidekick/validation";
import type {
  SidekickEngagementRecord,
  SidekickPaperRecord,
  SidekickReferenceRecord,
} from "@/lib/sidekick/types";

let client: OpenAI | null = null;

function getClient() {
  const config = getSidekickConfig();
  if (!config.openAiApiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey: config.openAiApiKey });
  }

  return client;
}

function parseJsonObject(outputText: string) {
  const trimmed = outputText.trim();
  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("LLM response did not contain a JSON object");
  }

  const parsed = tryParse(match[0]);
  if (!parsed) {
    throw new Error("LLM response JSON was malformed");
  }

  return parsed;
}

function tryParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function scoreClaimSpecificity(input: {
  claims: [string, string, string];
  noveltyStatement: string;
}) {
  const openai = getClient();
  if (!openai) {
    return {
      scores: heuristicClaimScores(input.claims),
      average: average(heuristicClaimScores(input.claims)),
    };
  }

  const config = getSidekickConfig();
  const response = await openai.responses.create({
    model: config.nanoModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `You are evaluating scientific claims for specificity and falsifiability.

Score each claim 1-5:
1 = Completely vague ("we propose a novel method for X")
2 = Somewhat specific but not testable ("we improve performance on X")
3 = Moderately specific ("we achieve state-of-the-art on benchmark X")
4 = Specific and testable ("we reduce error on X from 12% to 8%")
5 = Highly specific and falsifiable ("we reduce RMSD on CASP15 target T1024 from 2.3A to 1.8A using modified attention on MSA embeddings")

Claims:
1. ${input.claims[0]}
2. ${input.claims[1]}
3. ${input.claims[2]}
Novelty statement: ${input.noveltyStatement}

Return JSON only, no other text:
{"scores": [int, int, int], "average": float}`,
          },
        ],
      },
    ],
  });

  const parsed = parseJsonObject(response.output_text);
  return claimSpecificityResultSchema.parse(parsed);
}

export async function scoreSubstantiveness(prompt: string) {
  const openai = getClient();
  if (!openai) {
    return {
      score: heuristicSubstantiveness(prompt),
      reason: "Heuristic fallback based on detail density.",
    };
  }

  const config = getSidekickConfig();
  const response = await openai.responses.create({
    model: config.nanoModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ],
  });

  const parsed = parseJsonObject(response.output_text);
  return substantivenessResultSchema.parse(parsed);
}

export async function runAdversarialReview(input: {
  paper: SidekickPaperRecord;
  references: SidekickReferenceRecord[];
  engagements: SidekickEngagementRecord[];
  referenceAbstracts: string[];
}) {
  const openai = getClient();
  if (!openai) {
    return {
      claim_verification: {
        score: 0.5,
        findings: "Heuristic fallback review was used because no OpenAI API key is configured.",
      },
      reference_integrity: {
        score: input.paper.refValidityRate,
        findings: `Reference validity rate was ${input.paper.refValidityRate.toFixed(2)}.`,
      },
      methodological_coherence: {
        score: 0.5,
        findings: "Methodology fallback review could not inspect figures or tables.",
      },
      hallucination_flags: {
        score: 0.5,
        findings: "Fallback review cannot reliably detect hallucination fingerprints.",
      },
      survival_score: Math.max(0, Math.min(1, (input.paper.refValidityRate + 0.5) / 2)),
      summary: "Fallback review used due to missing OpenAI configuration.",
    };
  }

  const config = getSidekickConfig();
  const methodologySection = extractMethodologySection(input.paper.fullContent);
  const resultsSection = extractResultsSection(input.paper.fullContent);
  const engagementsSummary =
    input.engagements.length === 0
      ? "No engagements yet."
      : input.engagements
          .map((engagement) =>
            [
              `Type: ${engagement.type}`,
              `Target claim: ${engagement.targetClaim ?? "n/a"}`,
              `Result: ${engagement.result ?? "n/a"}`,
              `Substantiveness: ${engagement.substantiveness}`,
              `Content: ${engagement.content}`,
            ].join("\n")
          )
          .join("\n\n");

  const response = await openai.responses.create({
    model: config.adversarialModel,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `You are an adversarial scientific reviewer. Your job is NOT to judge quality or importance. Your job is to stress-test integrity. Find every flaw you can.

PAPER CLAIMS:
1. ${input.paper.claim1}
2. ${input.paper.claim2}
3. ${input.paper.claim3}

METHODOLOGY: ${input.paper.methodology}
NOVELTY STATEMENT: ${input.paper.noveltyStatement}

FULL METHODOLOGY SECTION: ${methodologySection}
FULL RESULTS SECTION: ${resultsSection}

CITED REFERENCE ABSTRACTS (sample):
${input.referenceAbstracts.join("\n\n") || "No reference abstracts available."}

ENGAGEMENT HISTORY:
${engagementsSummary}

Evaluate these four dimensions:

1. CLAIM VERIFICATION: Does the methodology actually describe work that could produce these claimed results? Are claims internally consistent with the data?

2. REFERENCE INTEGRITY: Based on the sampled reference abstracts, does this paper accurately represent what those references say?

3. METHODOLOGICAL COHERENCE: Are sample sizes consistent with statistical claims? Do figures match tables? Are parameters internally consistent?

4. HALLUCINATION FINGERPRINTS: Overly smooth prose, suspiciously round numbers, methodology that sounds rigorous but is vague under scrutiny, results that are too clean.

Return JSON only:
{
  "claim_verification": {"score": float 0-1, "findings": string},
  "reference_integrity": {"score": float 0-1, "findings": string},
  "methodological_coherence": {"score": float 0-1, "findings": string},
  "hallucination_flags": {"score": float 0-1, "findings": string},
  "survival_score": float 0-1,
  "summary": string
}`,
          },
        ],
      },
    ],
  });

  const parsed = parseJsonObject(response.output_text);
  return adversarialReviewResultSchema.parse(parsed);
}

function heuristicClaimScores(claims: [string, string, string]) {
  return claims.map((claim) => heuristicClaimScore(claim)) as [number, number, number];
}

function heuristicClaimScore(claim: string) {
  const text = claim.toLowerCase();
  let score = 1;

  if (/\d/.test(text)) {
    score += 1;
  }

  if (/(benchmark|dataset|cohort|claim|error|accuracy|auc|f1|rmsd|hours|percent|%)/.test(text)) {
    score += 1;
  }

  if (/(from .* to .*|reduce|increase|improve|compared with|versus|vs\.)/.test(text)) {
    score += 1;
  }

  if (text.split(/\s+/).length > 14) {
    score += 1;
  }

  return Math.max(1, Math.min(5, score));
}

function heuristicSubstantiveness(content: string) {
  const text = content.toLowerCase();
  let score = 1;

  if (text.length > 180) {
    score += 1;
  }

  if (/\d/.test(text)) {
    score += 1;
  }

  if (/(method|evidence|dataset|result|protocol|baseline|error|claim|because)/.test(text)) {
    score += 1;
  }

  if (text.split(/\s+/).length > 45) {
    score += 1;
  }

  return Math.max(1, Math.min(5, score));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}
