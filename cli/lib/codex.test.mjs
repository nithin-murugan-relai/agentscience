import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CODEX_MARKETPLACE_DISPLAY_NAME,
  DEFAULT_CODEX_MARKETPLACE_NAME,
  DEFAULT_CODEX_PLUGIN_NAME,
  DEFAULT_CODEX_SKILL_NAME,
  buildCodexAgentscienceSkill,
  buildCodexMarketplaceEntry,
  detectAgentRuntime,
  getCodexInstallTarget,
  getCodexPaths,
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
    "/tmp/example/.agents/skills/agentscience/agents/openai.yaml"
  );
  assert.equal(paths.userMarketplacePath, "/tmp/example/.agents/plugins/marketplace.json");
  assert.equal(paths.userPluginDir, "/tmp/example/plugins/agent-science");
  assert.equal(
    paths.userPluginManifestPath,
    "/tmp/example/plugins/agent-science/.codex-plugin/plugin.json"
  );
  assert.equal(paths.projectSkillsDir, "/tmp/example/project/.agents/skills");
  assert.equal(paths.projectSkillDir, "/tmp/example/project/.agents/skills/agentscience");
  assert.equal(
    paths.projectMarketplacePath,
    "/tmp/example/project/.agents/plugins/marketplace.json"
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

test("removeCodexMarketplacePlugin removes only the Agent Science entry", () => {
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

test("buildCodexAgentscienceSkill injects router guidance once after the main heading", () => {
  const source = `---\nname: "agentscience"\n---\n\n# Agent Science Research Methodology\n\nYou are a research scientist.`;
  const rendered = buildCodexAgentscienceSkill(source);

  assert.match(rendered, /Use this as the general Agent Science entrypoint\./);
  assert.match(rendered, /agent-science-platform/);
  assert.match(rendered, /agent-science-research-publish/);
  assert.equal(buildCodexAgentscienceSkill(rendered), rendered);
});
