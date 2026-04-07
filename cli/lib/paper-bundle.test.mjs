import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  classifyBundleArtifactKind,
  collectWorkspaceBundle,
  guessBundleContentType,
} from "./paper-bundle.mjs";

test("classifyBundleArtifactKind maps common research files to artifact roles", () => {
  assert.equal(classifyBundleArtifactKind("paper.tex"), "LATEX_SOURCE");
  assert.equal(classifyBundleArtifactKind("references.bib"), "BIBLIOGRAPHY");
  assert.equal(classifyBundleArtifactKind("scripts/analyze.py"), "ANALYSIS_CODE");
  assert.equal(classifyBundleArtifactKind("figures/build_plot.py"), "FIGURE_CODE");
  assert.equal(classifyBundleArtifactKind("data/clean.sh"), "DATA_PROCESSING_CODE");
  assert.equal(classifyBundleArtifactKind("README.md"), "DOCUMENTATION");
});

test("guessBundleContentType covers code, tabular data, and pdf files", () => {
  assert.equal(guessBundleContentType("paper.tex"), "application/x-latex");
  assert.equal(guessBundleContentType("analysis.py"), "text/plain");
  assert.equal(guessBundleContentType("results.csv"), "text/csv");
  assert.equal(guessBundleContentType("paper.pdf"), "application/pdf");
});

test("collectWorkspaceBundle separates artifact files from figures", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-bundle-"));
  mkdirSync(join(workspace, "scripts"), { recursive: true });
  mkdirSync(join(workspace, "figures"), { recursive: true });
  mkdirSync(join(workspace, "node_modules", "leftpad"), { recursive: true });
  writeFileSync(join(workspace, "paper.tex"), "\\section{Intro}");
  writeFileSync(join(workspace, "references.bib"), "@article{demo}");
  writeFileSync(join(workspace, "README.md"), "# Notes");
  writeFileSync(join(workspace, "scripts", "analyze.py"), "print('hi')\n");
  writeFileSync(join(workspace, "figures", "build_plot.py"), "print('plot')\n");
  writeFileSync(join(workspace, "figures", "plot.png"), "png");
  writeFileSync(join(workspace, "paper.pdf"), "%PDF-1.4");
  writeFileSync(join(workspace, "paper.aux"), "ignore me");
  writeFileSync(join(workspace, "node_modules", "leftpad", "index.js"), "ignored");

  const bundle = collectWorkspaceBundle({ workspaceDir: workspace });
  const artifactPaths = bundle.artifacts.map((artifact) => artifact.path).sort();
  const figureNames = bundle.figures.map((figure) => figure.fileName).sort();

  assert.deepEqual(artifactPaths, [
    "README.md",
    "figures/build_plot.py",
    "paper.pdf",
    "paper.tex",
    "references.bib",
    "scripts/analyze.py",
  ]);
  assert.deepEqual(figureNames, ["plot.png"]);
  assert.equal(await bundle.artifacts[0]?.file.text(), "# Notes");
});
