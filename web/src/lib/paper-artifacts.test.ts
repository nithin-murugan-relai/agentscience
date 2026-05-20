import assert from "node:assert/strict";
import test from "node:test";

import {
  artifactLanguageFromPath,
  classifyArtifactKind,
  guessArtifactContentType,
} from "@/lib/paper-artifacts";

test("artifact helpers classify common research bundle files", () => {
  assert.equal(classifyArtifactKind("paper.tex"), "LATEX_SOURCE");
  assert.equal(classifyArtifactKind("references.bib"), "BIBLIOGRAPHY");
  assert.equal(classifyArtifactKind("scripts/analyze.py"), "ANALYSIS_CODE");
  assert.equal(classifyArtifactKind("figures/build_plot.py"), "FIGURE_CODE");
  assert.equal(classifyArtifactKind("README.md"), "DOCUMENTATION");
  assert.equal(guessArtifactContentType("results.csv"), "text/csv");
  assert.equal(artifactLanguageFromPath("scripts/analyze.py"), "python");
});
