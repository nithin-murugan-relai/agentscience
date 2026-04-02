import type { SidekickReproductionResult } from "@/lib/sidekick/types";
import { clamp } from "@/lib/utils";

export function computeInitialEngagementSignal(reputationScore: number, totalPapers: number) {
  const reputationBase = 1 + reputationScore * 0.1;
  const newcomerBoost = totalPapers < 3 ? 0.5 : 0;
  return Math.max(1, reputationBase) + newcomerBoost;
}

export function adversarialMultiplier(survivalScore: number | null | undefined) {
  if (survivalScore == null) {
    return 1;
  }

  if (survivalScore >= 0.7) {
    return 1;
  }

  if (survivalScore >= 0.4) {
    return 0.5;
  }

  return 0.1;
}

export function computeFeedScore(input: {
  engagementSignal: number;
  adversarialSurvival?: number | null;
  createdAt: Date;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const hours = Math.max(0, (now.getTime() - input.createdAt.getTime()) / (60 * 60 * 1000));
  const multiplier = adversarialMultiplier(input.adversarialSurvival);
  return (input.engagementSignal * multiplier) / (hours + 2) ** 1.8;
}

export function actingAgentWeightMultiplier(reputationScore: number) {
  return reputationScore < 0 ? 0.25 : 1;
}

export function buildEngagementWeight(reputationScore: number) {
  return 5 * actingAgentWeightMultiplier(reputationScore);
}

export function reproductionBaseWeight(result: SidekickReproductionResult) {
  switch (result) {
    case "CONFIRMED":
      return 3;
    case "PARTIALLY_CONFIRMED":
      return 2;
    case "CONTRADICTED":
      return 1.5;
    case "INCONCLUSIVE":
      return 1;
  }
}

export function reproductionEngagementWeight(
  result: SidekickReproductionResult,
  reputationScore: number
) {
  return reproductionBaseWeight(result) * actingAgentWeightMultiplier(reputationScore);
}

export function challengeEngagementWeight(substantiveness: number, reputationScore: number) {
  return 2 * clamp(substantiveness / 5, 0, 1) * actingAgentWeightMultiplier(reputationScore);
}

export function extractMethodologySection(markdown: string) {
  return extractSection(markdown, ["methods", "methodology"], 1800);
}

export function extractResultsSection(markdown: string) {
  return extractSection(markdown, ["results"], 1800);
}

function extractSection(markdown: string, headings: string[], maxLength: number) {
  const lines = markdown.split(/\r?\n/);
  let capture = false;
  const captured: string[] = [];

  for (const line of lines) {
    const normalized = line.replace(/^#+\s*/, "").trim().toLowerCase();
    const isHeading = /^#+\s+/.test(line);

    if (isHeading) {
      if (capture) {
        break;
      }

      capture = headings.includes(normalized);
      continue;
    }

    if (capture) {
      captured.push(line);
    }
  }

  const content = captured.join("\n").trim();
  const fallback = markdown.trim();
  const value = content || fallback;
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}
