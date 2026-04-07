import assert from "node:assert/strict";
import test from "node:test";

import {
  artifactLanguageFromPath,
  classifyArtifactKind,
  guessArtifactContentType,
} from "@/lib/paper-artifacts";
import { parseArtifactUploads } from "@/lib/paper-upload";

test("artifact helpers classify common research bundle files", () => {
  assert.equal(classifyArtifactKind("paper.tex"), "LATEX_SOURCE");
  assert.equal(classifyArtifactKind("references.bib"), "BIBLIOGRAPHY");
  assert.equal(classifyArtifactKind("scripts/analyze.py"), "ANALYSIS_CODE");
  assert.equal(classifyArtifactKind("figures/build_plot.py"), "FIGURE_CODE");
  assert.equal(classifyArtifactKind("README.md"), "DOCUMENTATION");
  assert.equal(guessArtifactContentType("results.csv"), "text/csv");
  assert.equal(artifactLanguageFromPath("scripts/analyze.py"), "python");
});

test("parseArtifactUploads reconstructs upload descriptors from a manifest", async () => {
  const form = new FormData();
  form.set(
    "artifactManifest",
    JSON.stringify([
      {
        fieldName: "artifact_0",
        path: "scripts/analyze.py",
        contentType: "text/plain",
        kind: "ANALYSIS_CODE",
      },
      {
        fieldName: "artifact_1",
        path: "README.md",
        kind: "DOCUMENTATION",
      },
    ])
  );
  form.set("artifact_0", new File(["print('hello')\n"], "analyze.py", { type: "text/plain" }));
  form.set("artifact_1", new File(["# Notes\n"], "README.md", { type: "text/markdown" }));

  const artifacts = await parseArtifactUploads(form);

  assert.equal(artifacts.length, 2);
  assert.equal(artifacts[0]?.path, "scripts/analyze.py");
  assert.equal(artifacts[0]?.kind, "ANALYSIS_CODE");
  assert.equal(artifacts[0]?.contentType, "text/plain");
  assert.equal(artifacts[0]?.bytes.toString("utf8"), "print('hello')\n");
  assert.equal(artifacts[1]?.contentType, "text/markdown");
});

test("parseArtifactUploads rejects incomplete bundle entries", async () => {
  const form = new FormData();
  form.set(
    "artifactManifest",
    JSON.stringify([
      {
        fieldName: "artifact_0",
        path: "scripts/analyze.py",
      },
    ])
  );

  await assert.rejects(
    () => parseArtifactUploads(form),
    /Artifact payload missing for scripts\/analyze.py\./
  );
});
