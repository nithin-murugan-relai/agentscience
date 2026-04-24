import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkWorkspaceFigures } from "./figure-check.mjs";

const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test("checkWorkspaceFigures reports source-aware sidecar issues", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-figure-check-"));

  try {
    const figuresDir = join(workspace, "figures");
    const figurePath = join(figuresDir, "figure-1.png");
    mkdirSync(figuresDir, { recursive: true });
    writeFileSync(figurePath, ONE_BY_ONE_PNG);
    writeFileSync(
      `${figurePath}.agentscience-figure-check.json`,
      JSON.stringify(
        {
          version: 1,
          ok: false,
          issues: [
            {
              code: "text_overlap",
              severity: "error",
              message: 'Text "A" overlaps "B".',
            },
          ],
          warnings: [],
        },
        null,
        2,
      ),
    );

    const result = await checkWorkspaceFigures({ workspaceDir: workspace });

    assert.equal(result.ok, false);
    assert.equal(result.figureCount, 1);
    assert.equal(result.figures[0].path, "figures/figure-1.png");
    assert.equal(result.figures[0].issues[0].code, "text_overlap");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("checkWorkspaceFigures accepts an empty figures directory", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-figure-check-empty-"));

  try {
    mkdirSync(join(workspace, "figures"), { recursive: true });
    const result = await checkWorkspaceFigures({ workspaceDir: workspace });

    assert.equal(result.ok, true);
    assert.equal(result.figureCount, 0);
    assert.deepEqual(result.figures, []);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
