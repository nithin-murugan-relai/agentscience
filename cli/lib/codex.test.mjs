import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { compileCodexPlugin, loadPersonality } from "@agentscience/personality";

import {
  DEFAULT_CODEX_MARKETPLACE_DISPLAY_NAME,
  DEFAULT_CODEX_MARKETPLACE_NAME,
  DEFAULT_CODEX_PLUGIN_NAME,
  DEFAULT_CODEX_SKILL_NAME,
  buildCodexMarketplaceEntry,
  detectAgentRuntime,
  getCodexInstallTarget,
  getCodexPaths,
  installCodexPlugin,
  removeCodexMarketplacePlugin,
  upsertCodexMarketplace,
} from "./codex.mjs";

test("getCodexPaths uses official Codex plugin and legacy skill locations", () => {
  const paths = getCodexPaths({
    homeDir: "/tmp/example",
    cwd: "/tmp/example/project",
  });

  assert.equal(paths.skillName, DEFAULT_CODEX_SKILL_NAME);
  assert.equal(paths.pluginName, DEFAULT_CODEX_PLUGIN_NAME);
  assert.equal(paths.userSkillsDir, "/tmp/example/.agents/skills");
  assert.equal(paths.userSkillDir, "/tmp/example/.agents/skills/agentscience");
  assert.equal(paths.userSkillPath, "/tmp/example/.agents/skills/agentscience/SKILL.md");
  assert.equal(
    paths.userMetadataPath,
    "/tmp/example/.agents/skills/agentscience/agents/openai.yaml",
  );
  assert.equal(paths.userMarketplacePath, "/tmp/example/.agents/plugins/marketplace.json");
  assert.equal(paths.userPluginDir, "/tmp/example/plugins/agent-science");
  assert.equal(
    paths.userPluginManifestPath,
    "/tmp/example/plugins/agent-science/.codex-plugin/plugin.json",
  );
  assert.equal(paths.projectSkillsDir, "/tmp/example/project/.agents/skills");
  assert.equal(paths.projectSkillDir, "/tmp/example/project/.agents/skills/agentscience");
  assert.equal(
    paths.projectMarketplacePath,
    "/tmp/example/project/.agents/plugins/marketplace.json",
  );
  assert.equal(paths.projectPluginDir, "/tmp/example/project/plugins/agent-science");
});

test("detectAgentRuntime honors explicit hints and runtime presence", () => {
  assert.equal(detectAgentRuntime({ hint: "codex", hasClaudeCode: true }), "codex");
  assert.equal(detectAgentRuntime({ hasClaudeCode: true, hasCodex: true }), "claude-code");
  assert.equal(detectAgentRuntime({ hasCodex: true }), "codex");
  assert.equal(detectAgentRuntime({ claudeCodeHomeExists: true }), "claude-code");
  assert.equal(detectAgentRuntime({ codexHomeExists: true }), "codex");
  assert.equal(detectAgentRuntime({}), "none");
});

test("getCodexInstallTarget resolves user and project plugin targets", () => {
  const paths = getCodexPaths({
    homeDir: "/tmp/example",
    cwd: "/tmp/example/project",
  });

  assert.deepEqual(getCodexInstallTarget({ paths }), {
    scope: "user",
    pluginName: "agent-science",
    marketplaceDir: "/tmp/example/.agents/plugins",
    marketplacePath: "/tmp/example/.agents/plugins/marketplace.json",
    pluginDir: "/tmp/example/plugins/agent-science",
    pluginManifestPath: "/tmp/example/plugins/agent-science/.codex-plugin/plugin.json",
    legacySkillDir: "/tmp/example/.agents/skills/agentscience",
    legacySkillPath: "/tmp/example/.agents/skills/agentscience/SKILL.md",
    legacyMetadataPath: "/tmp/example/.agents/skills/agentscience/agents/openai.yaml",
  });

  assert.deepEqual(getCodexInstallTarget({ isProject: true, paths }), {
    scope: "project",
    pluginName: "agent-science",
    marketplaceDir: "/tmp/example/project/.agents/plugins",
    marketplacePath: "/tmp/example/project/.agents/plugins/marketplace.json",
    pluginDir: "/tmp/example/project/plugins/agent-science",
    pluginManifestPath:
      "/tmp/example/project/plugins/agent-science/.codex-plugin/plugin.json",
    legacySkillDir: "/tmp/example/project/.agents/skills/agentscience",
    legacySkillPath: "/tmp/example/project/.agents/skills/agentscience/SKILL.md",
    legacyMetadataPath:
      "/tmp/example/project/.agents/skills/agentscience/agents/openai.yaml",
  });
});

test("buildCodexMarketplaceEntry uses the supported local plugin shape", () => {
  assert.deepEqual(buildCodexMarketplaceEntry(), {
    name: "agent-science",
    source: {
      source: "local",
      path: "./plugins/agent-science",
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category: "Research",
  });
});

test("upsertCodexMarketplace seeds defaults and preserves unrelated plugins", () => {
  const marketplace = upsertCodexMarketplace({
    interface: {},
    plugins: [{ name: "other-plugin", source: { source: "local", path: "./plugins/other" } }],
  });

  assert.equal(marketplace.name, DEFAULT_CODEX_MARKETPLACE_NAME);
  assert.equal(marketplace.interface.displayName, DEFAULT_CODEX_MARKETPLACE_DISPLAY_NAME);
  assert.deepEqual(marketplace.plugins, [
    { name: "other-plugin", source: { source: "local", path: "./plugins/other" } },
    buildCodexMarketplaceEntry(),
  ]);
});

test("removeCodexMarketplacePlugin removes only the AgentScience entry", () => {
  const marketplace = removeCodexMarketplacePlugin({
    name: "custom",
    interface: { displayName: "Custom Marketplace" },
    plugins: [
      buildCodexMarketplaceEntry(),
      { name: "other-plugin", source: { source: "local", path: "./plugins/other" } },
    ],
  });

  assert.equal(marketplace.name, "custom");
  assert.equal(marketplace.interface.displayName, "Custom Marketplace");
  assert.deepEqual(marketplace.plugins, [
    { name: "other-plugin", source: { source: "local", path: "./plugins/other" } },
  ]);
});

test("installCodexPlugin writes the compiled plugin tree and links it to the personality hash", () => {
  const rootDir = mkdtempSync(join(tmpdir(), "agentscience-codex-"));
  const cwd = join(rootDir, "project");
  mkdirSync(cwd, { recursive: true });

  const paths = getCodexPaths({
    homeDir: rootDir,
    cwd,
  });

  mkdirSync(paths.userSkillDir, { recursive: true });
  writeFileSync(paths.userSkillPath, "legacy skill\n", "utf8");

  try {
    const installed = installCodexPlugin({ paths });
    const personality = loadPersonality();
    const compiledPlugin = compileCodexPlugin(personality);

    assert.equal(installed.pluginName, "agent-science");
    assert.equal(installed.personalityVersion, personality.version);
    assert.equal(installed.personalityContentHash, personality.contentHash);
    assert.deepEqual(installed.legacySkillRemoved, [paths.userSkillDir]);
    assert.equal(existsSync(paths.userSkillDir), false);

    const skillPath = join(installed.pluginDir, "skills", "agentscience", "SKILL.md");
    const manifestPath = join(installed.pluginDir, ".codex-plugin", "plugin.json");
    const marketplacePath = paths.userMarketplacePath;

    assert.equal(readFileSync(skillPath, "utf8"), compiledPlugin.files["skills/agentscience/SKILL.md"]);
    assert.match(readFileSync(skillPath, "utf8"), new RegExp(personality.contentHash));
    assert.equal(
      readFileSync(manifestPath, "utf8"),
      compiledPlugin.files[".codex-plugin/plugin.json"],
    );
    assert.deepEqual(
      JSON.parse(readFileSync(marketplacePath, "utf8")),
      upsertCodexMarketplace(undefined),
    );
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
