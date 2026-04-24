import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  getWorkspaceBase,
  initPaperWorkspace,
  listPaperWorkspaces,
  slugify,
} from "./workspace.mjs";

test("getWorkspaceBase defaults to a home-scoped papers directory", () => {
  assert.match(getWorkspaceBase(), /agentscience-papers$/);
});

test("slugify turns an idea into a filesystem-safe slug", () => {
  assert.equal(
    slugify("Does fine-tuning improve sepsis prediction?"),
    "does-fine-tuning-improve-sepsis-prediction"
  );
  assert.equal(slugify("   "), "paper");
});

test("initPaperWorkspace creates the per-paper layout and listPaperWorkspaces discovers it", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "agentscience-workspace-test-"));
  const fakeBinDir = join(tempRoot, "fake-bin");
  const fakePythonPath = join(fakeBinDir, "python3");
  const originalPath = process.env.PATH;

  mkdirSync(fakeBinDir, { recursive: true });
  writeFileSync(
    fakePythonPath,
    "#!/bin/sh\nmkdir -p \"$PWD/.venv/bin\"\n: > \"$PWD/.venv/bin/python3\"\n",
    { mode: 0o755 }
  );

  try {
    process.env.PATH = `${fakeBinDir}:${originalPath ?? ""}`;

    const paperDir = initPaperWorkspace("Butterfly antenna clock variation", {
      workspaceBase: tempRoot,
    });

    assert.equal(paperDir, join(tempRoot, "butterfly-antenna-clock-variation"));
    assert.ok(existsSync(join(paperDir, ".venv", "bin", "python3")));
    assert.ok(existsSync(join(paperDir, "code")));
    assert.ok(existsSync(join(paperDir, "data", "raw")));
    assert.ok(existsSync(join(paperDir, "data", "processed")));
    assert.ok(existsSync(join(paperDir, "figures")));
    assert.ok(existsSync(join(paperDir, "paper.tex")));
    assert.ok(existsSync(join(paperDir, "references.bib")));
    assert.ok(existsSync(join(paperDir, "requirements.txt")));
    assert.ok(existsSync(join(paperDir, "experiment-log.md")));
    assert.ok(existsSync(join(paperDir, "figure-descriptions.md")));
    assert.ok(existsSync(join(paperDir, "abstract.txt")));
    assert.ok(existsSync(join(paperDir, "code", "agentscience_figures.py")));
    assert.match(readFileSync(join(paperDir, "paper.tex"), "utf8"), /\\documentclass/);
    assert.match(
      readFileSync(join(paperDir, "code", "agentscience_figures.py"), "utf8"),
      /def save_figure/,
    );

    const listed = listPaperWorkspaces({ workspaceBase: tempRoot });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].slug, "butterfly-antenna-clock-variation");
    assert.equal(listed[0].path, paperDir);
  } finally {
    process.env.PATH = originalPath;
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
