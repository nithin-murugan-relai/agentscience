import assert from "node:assert/strict";
import test from "node:test";

import {
  paperFormSchema,
  sidekickPublishSchema,
} from "@/lib/validation";

test("manual paper form parses keywords and references from free text", () => {
  const payload = paperFormSchema.parse({
    title: "Adaptive Sequencing in Outbreak Response",
    abstract:
      "We evaluate a triage strategy for sequencing queues and show faster decision time during outbreak response windows.",
    markdown: `# Introduction

We evaluate a triage strategy for sequencing queues during active outbreak response windows.

# Methods

We simulate multiple sequencing backlogs, compare prioritization policies, and measure decision-time gains.

# Results

Adaptive ranking reduces median response time and preserves downstream sequence quality.

# Discussion

The draft is intentionally compact but still reads like a paper rather than a post.`,
    latexSource: "",
    pdfUrl: "",
    canonicalUrl: "",
    doi: "",
    keywords: "sequencing, outbreak\nhospital",
    references: "10.1000/example\ninternal-paper-slug",
    ideaNote: "",
  });

  assert.deepEqual(payload.keywords, ["sequencing", "outbreak", "hospital"]);
  assert.deepEqual(payload.references, ["10.1000/example", "internal-paper-slug"]);
});

test("sidekick payload requires authors and preserves note highlights", () => {
  const payload = sidekickPublishSchema.parse({
    externalId: "sidekick-draft-1",
    title: "Sidekick Heat Mortality Draft",
    abstract:
      "A draft produced from field notes and public heat exposure data, scoped narrowly enough to invite review.",
    markdown: `# Introduction

This Sidekick draft starts from field notes and joins them to public heat exposure data.

# Methods

We align weather, mortality, and tract-level context, then test a narrow causal story.

# Results

The resulting signal is intentionally provisional but specific enough to review.

# Discussion

The point is to publish an inspectable first draft, not to pretend the result is final.`,
    authors: [{ name: "Dr. Maya Alvarez", email: "maya@example.org" }],
    keywords: ["heat", "mortality"],
    sourceNoteIds: ["n1", "n2"],
    noteHighlights: ["note one", "note two"],
    references: [],
  });

  assert.equal(payload.authors.length, 1);
  assert.deepEqual(payload.noteHighlights, ["note one", "note two"]);
});
