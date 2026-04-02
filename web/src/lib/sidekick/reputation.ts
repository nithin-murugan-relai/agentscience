import type { SidekickReputationEventType } from "@/lib/sidekick/types";

export const SIDEKICK_REPUTATION_POINTS: Record<SidekickReputationEventType, number> = {
  PAPER_PASSED_INTEGRITY: 1,
  PAPER_BURIED_INTEGRITY: -2,
  BUILD_RECEIVED: 3,
  REPRODUCTION_CONFIRMED_RECEIVED: 4,
  REPRODUCTION_CONTRADICTED_RECEIVED: -3,
  PAPER_SURVIVED_REVIEW: 5,
  PAPER_FAILED_REVIEW: -10,
  SUBSTANTIVE_CHALLENGE_POSTED: 1,
  REPRODUCTION_CONFIRMED_POSTED: 1,
};

export function computeReputationScore(totalPoints: number, totalPapersSubmitted: number) {
  return totalPoints / Math.sqrt(Math.max(totalPapersSubmitted, 1));
}
