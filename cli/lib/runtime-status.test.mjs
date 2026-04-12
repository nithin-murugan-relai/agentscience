import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { PERSONALITY_CONTENT_HASH, PERSONALITY_VERSION } from "@agentscience/personality";

import { getCodexInstallTarget, getCodexPaths } from "./codex.mjs";
import { getClaudeCodePaths } from "./runtime-status.mjs";
import {
  buildRuntimeStatus,
  compareSemver,
  readInstalledRuntimeSurfaces,
} from "./runtime-status.mjs";

function metadataComment(version = PERSONALITY_VERSION, hash = PERSONALITY_CONTENT_HASH) {
  return `<!-- AgentScience personality version: ${version}; hash: ${hash} -->\n`;
}

test("compareSemver compares dotted numeric versions", () => {
  assert.equal(compareSemver("0.5.0", "0.5.0"), 0);
  assert.equal(compareSemver("0.5.0", "0.5.1"), -1);
  assert.equal(compareSemver("0.6.0", "0.5.9"), 1);
});

test("readInstalledRuntimeSurfaces prefers the project install when present", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "agentscience-runtime-"));
  const homeDir = join(rootDir, "home");
  const cwd = join(rootDir, "project");
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  const codexPaths = getCodexPaths({ homeDir, cwd });
  const codexProjectTarget = getCodexInstallTarget({ isProject: true, paths: codexPaths });
  const claudePaths = getClaudeCodePaths({ homeDir, cwd });

  try {
    mkdirSync(join(codexProjectTarget.pluginDir, "skills", "agentscience"), { recursive: true });
    writeFileSync(
      join(codexProjectTarget.pluginDir, "skills", "agentscience", "SKILL.md"),
      metadataComment(),
      "utf8",
    );

    mkdirSync(dirname(claudePaths.userCommandPath), { recursive: true });
    writeFileSync(claudePaths.userCommandPath, metadataComment(), "utf8");

    const surfaces = readInstalledRuntimeSurfaces({
      cwd,
      homeDir,
      currentPersonalityVersion: PERSONALITY_VERSION,
      currentPersonalityContentHash: PERSONALITY_CONTENT_HASH,
    });

    assert.equal(surfaces.codex.active.scope, "project");
    assert.equal(surfaces.codex.active.current, true);
    assert.equal(surfaces.codex.active.installMode, "copied");
    assert.equal(surfaces.claudeCode.active.scope, "user");
    assert.equal(surfaces.claudeCode.active.current, true);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("buildRuntimeStatus reports npm updates and stale linked surfaces", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "agentscience-runtime-"));
  const homeDir = join(rootDir, "home");
  const cwd = join(rootDir, "project");
  mkdirSync(homeDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });

  const codexPaths = getCodexPaths({ homeDir, cwd });
  const codexUserTarget = getCodexInstallTarget({ paths: codexPaths });
  const staleHash = `${"0".repeat(PERSONALITY_CONTENT_HASH.length)}`;

  try {
    mkdirSync(join(rootDir, "linked-plugin", "skills", "agentscience"), { recursive: true });
    writeFileSync(
      join(rootDir, "linked-plugin", "skills", "agentscience", "SKILL.md"),
      metadataComment("1.0.0", staleHash),
      "utf8",
    );
    mkdirSync(dirname(codexUserTarget.pluginDir), { recursive: true });
    symlinkSync(join(rootDir, "linked-plugin"), codexUserTarget.pluginDir, "dir");

    const status = await buildRuntimeStatus({
      currentVersion: "0.5.0",
      currentPersonalityVersion: PERSONALITY_VERSION,
      currentPersonalityContentHash: PERSONALITY_CONTENT_HASH,
      cwd,
      homeDir,
      forceRefresh: true,
      fetchImpl: async () =>
        new Response(JSON.stringify({ version: "0.6.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });

    assert.equal(status.updateAvailable, true);
    assert.equal(status.codex.active.installMode, "linked");
    assert.equal(status.codex.active.refreshRecommended, true);
    assert.ok(status.nextSteps.includes("npm install -g agentscience@latest"));
    assert.ok(status.nextSteps.includes("agentscience setup codex"));
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
