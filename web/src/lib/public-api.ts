import { serializePaperSummary, type PaperSummary } from "@/lib/platform";

export function parsePositiveInt(
  value: string | null | undefined,
  fallback: number,
  max = 100
) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(max, Math.floor(parsed));
}

export function serializePublicRanking(paper: PaperSummary, rank: number) {
  return {
    rank,
    ...serializePaperSummary(paper),
  };
}
