import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkRegistryCandidatesInBatches, compilePaper, copyTemplate } from "./pipeline.mjs";

test("copyTemplate exposes the AgentScience manuscript helper API", () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-template-test-"));
  try {
    const templatePath = copyTemplate(workspace);
    const source = readFileSync(templatePath, "utf8");

    assert.match(source, /\\mainfigure\{path\}\{caption\}\{label\}/);
    assert.match(source, /\\widemainfigure\{path\}\{caption\}\{label\}/);
    assert.match(source, /\\suppfigure\{path\}\{caption\}\{label\}/);
    assert.match(source, /\\maintable\{caption\}\{label\}\{tabular\/body\}/);
    assert.match(source, /\\supptable\{caption\}\{label\}\{tabular\/body\}/);
    assert.match(source, /\\printsupplement/);
    assert.match(source, /\\pagecolor\{white\}/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("copyTemplate fills the configured publication author", () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-template-author-test-"));
  try {
    const templatePath = copyTemplate(workspace, "paper.tex", {
      authorName: "Vineet Reddy",
      authorAffiliation: "University of California, Berkeley",
    });
    const source = readFileSync(templatePath, "utf8");

    assert.match(
      source,
      /\\author\{%\n  Vineet Reddy\\thanks\{University of California, Berkeley\}\n\}/,
    );
    assert.doesNotMatch(source, /AUTHOR NAME/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("compilePaper prefers latexmk from the managed paper toolchain", () => {
  const workspace = mkdtempSync(join(tmpdir(), "agentscience-compile-test-"));
  const toolchain = mkdtempSync(join(tmpdir(), "agentscience-toolchain-test-"));
  const previousToolchain = process.env.AGENTSCIENCE_PAPER_TOOLCHAIN_BIN_DIR;

  try {
    const binDir = join(toolchain, "bin");
    mkdirSync(binDir, { recursive: true });
    const latexmkPath = join(binDir, "latexmk");
    writeFileSync(
      latexmkPath,
      [
        "#!/usr/bin/env node",
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "if (process.argv.includes('-v')) { console.log('Latexmk test'); process.exit(0); }",
        "fs.writeFileSync(path.join(process.cwd(), 'latexmk.args'), process.argv.slice(2).join('\\n'));",
        "fs.writeFileSync(path.join(process.cwd(), 'paper.pdf'), '%PDF-1.4\\n');",
      ].join("\n"),
    );
    chmodSync(latexmkPath, 0o755);

    writeFileSync(
      join(workspace, "paper.tex"),
      "\\documentclass{article}\\begin{document}Hello\\end{document}\n",
    );
    process.env.AGENTSCIENCE_PAPER_TOOLCHAIN_BIN_DIR = binDir;

    const pdfPath = compilePaper(workspace);

    assert.equal(pdfPath, join(workspace, "paper.pdf"));
    assert.match(readFileSync(join(workspace, "latexmk.args"), "utf8"), /-pdf/);
    assert.match(readFileSync(join(workspace, "latexmk.args"), "utf8"), /-halt-on-error/);
  } finally {
    if (previousToolchain === undefined) {
      delete process.env.AGENTSCIENCE_PAPER_TOOLCHAIN_BIN_DIR;
    } else {
      process.env.AGENTSCIENCE_PAPER_TOOLCHAIN_BIN_DIR = previousToolchain;
    }
    rmSync(workspace, { recursive: true, force: true });
    rmSync(toolchain, { recursive: true, force: true });
  }
});

test("checkRegistryCandidatesInBatches preserves order across multiple API batches", async () => {
  const datasets = Array.from({ length: 45 }, (_, index) => ({
    name: `dataset-${index + 1}`,
  }));
  const calls = [];

  const result = await checkRegistryCandidatesInBatches({
    datasets,
    batchSize: 20,
    checkFn: async ({ datasets: batch }) => {
      calls.push(batch.map((entry) => entry.name));
      return {
        datasets: batch.map((entry) => ({
          candidate: entry,
          status: "new",
          matches: [],
        })),
      };
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls.map((batch) => batch.length), [20, 20, 5]);
  assert.deepEqual(
    result.datasets.map((entry) => entry.candidate.name),
    datasets.map((entry) => entry.name),
  );
});
