import assert from "node:assert/strict";
import test from "node:test";

import { buildPaperRankings } from "@/lib/ranking";

test("citation and topic edges lift the most connected paper", () => {
  const rankings = buildPaperRankings([
    {
      paperId: "paper-a",
      title: "Paper A",
      abstract: "A paper about adaptive sequencing in hospitals.",
      markdown: "# Methods\n\nWe sequence samples and rank them adaptively.",
      keywords: ["sequencing", "hospital", "adaptive"],
      authorIds: ["maya"],
      referenceTargets: ["paper-b"],
      reviewScores: [
        {
          novelty: 4,
          rigor: 4,
          clarity: 4,
          reproducibility: 4,
          verdict: "ENDORSE",
        },
      ],
      saveCount: 3,
      ideaCount: 1,
    },
    {
      paperId: "paper-b",
      title: "Paper B",
      abstract: "A central paper about sequencing and outbreak response.",
      markdown:
        "# Introduction\n\n# Methods\n\n# Results\n\n# Discussion\n\nA richer study with clear sections and references.",
      keywords: ["sequencing", "outbreak", "hospital"],
      authorIds: ["luca"],
      referenceTargets: [],
      reviewScores: [
        {
          novelty: 5,
          rigor: 5,
          clarity: 4,
          reproducibility: 4,
          verdict: "ENDORSE",
        },
      ],
      saveCount: 8,
      ideaCount: 2,
    },
    {
      paperId: "paper-c",
      title: "Paper C",
      abstract: "A less connected paper about climate mortality.",
      markdown: "# Methods\n\nSparse structure.",
      keywords: ["climate", "mortality"],
      authorIds: ["sana"],
      referenceTargets: ["paper-b"],
      reviewScores: [
        {
          novelty: 3,
          rigor: 3,
          clarity: 4,
          reproducibility: 3,
          verdict: "CONCERN",
        },
      ],
      saveCount: 1,
      ideaCount: 0,
    },
  ]);

  assert.equal(rankings[0]?.paperId, "paper-b");
  assert.ok(rankings[0].networkScore >= rankings[1].networkScore);
});

test("rankings fall back to heuristic ai when no ai assessment is present", () => {
  const [ranking] = buildPaperRankings([
    {
      paperId: "paper-a",
      title: "Field Notes to Preprint",
      abstract: "A structured abstract that still lacks a model-generated assessment.",
      markdown:
        "# Introduction\n\n# Methods\n\n# Results\n\n# Discussion\n\nReferences and method detail keep the heuristic alive.",
      keywords: ["field-notes", "notes", "preprint"],
      authorIds: ["studio"],
      referenceTargets: [],
      reviewScores: [],
      saveCount: 0,
      ideaCount: 2,
    },
  ]);

  assert.equal(ranking.usedHeuristicAi, true);
  assert.ok(ranking.aiScore > 0);
  assert.ok(ranking.aiSummary.includes("Heuristic fallback"));
  assert.ok(ranking.integritySummary.includes("Integrity stress-test fallback"));
});

test("heuristic-only drafts do not outrank genuinely reviewed papers", () => {
  const rankings = buildPaperRankings([
    {
      paperId: "reviewed-paper",
      title: "Reviewed Paper",
      abstract: "Peer-reviewed work with concrete results and a balanced summary.",
      markdown:
        "# Introduction\n\n# Methods\n\n# Results\n\n# Discussion\n\nReferences are present and the study was reviewed in detail.",
      keywords: ["reviewed", "results", "science"],
      authorIds: ["maya"],
      referenceTargets: [],
      reviewScores: [
        {
          novelty: 5,
          rigor: 5,
          clarity: 4,
          reproducibility: 5,
          verdict: "ENDORSE",
        },
      ],
      saveCount: 1,
      ideaCount: 0,
    },
    {
      paperId: "heuristic-paper",
      title: "Polished Draft",
      abstract: "A polished draft with good structure but no external review.",
      markdown:
        "# Introduction\n\n# Methods\n\n# Results\n\n# Discussion\n\nThis reads cleanly but has not been validated by peers.",
      keywords: ["draft", "polished", "structure"],
      authorIds: ["luca"],
      referenceTargets: [],
      reviewScores: [],
      saveCount: 4,
      ideaCount: 2,
    },
  ]);

  assert.equal(rankings[0]?.paperId, "reviewed-paper");
  assert.ok(rankings[0].finalScore > rankings[1].finalScore);
});
