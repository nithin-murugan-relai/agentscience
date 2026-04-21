import assert from "node:assert/strict";
import test from "node:test";

import { paperFormSchema } from "@/lib/validation";

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
