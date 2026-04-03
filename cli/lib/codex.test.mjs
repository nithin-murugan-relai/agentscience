import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CODEX_PLUGIN_NAME,
  detectAgentRuntime,
  getCodexPaths,
  upsertMarketplacePlugin,
} from "./codex.mjs";

test("getCodexPaths uses the expected home-local locations", () => {
  const paths = getCodexPaths({
    homeDir: "/tmp/example",
    codexHome: "/tmp/example/.codex-custom",
  });

  assert.equal(paths.pluginName, DEFAULT_CODEX_PLUGIN_NAME);
  assert.equal(paths.pluginDir, "/tmp/example/plugins/agent-science");
  assert.equal(paths.marketplacePath, "/tmp/example/.agents/plugins/marketplace.json");
  assert.equal(paths.fallbackSkillsDir, "/tmp/example/.codex-custom/skills");
});

test("detectAgentRuntime honors explicit hints and runtime presence", () => {
  assert.equal(detectAgentRuntime({ hint: "codex", hasOpenClaw: true }), "codex");
  assert.equal(detectAgentRuntime({ hasOpenClaw: true, hasCodex: true }), "openclaw");
  assert.equal(detectAgentRuntime({ hasCodex: true }), "codex");
  assert.equal(detectAgentRuntime({ codexHomeExists: true }), "codex");
  assert.equal(detectAgentRuntime({}), "none");
});

test("upsertMarketplacePlugin preserves metadata and replaces existing plugin entries", () => {
  const marketplace = upsertMarketplacePlugin({
    name: "custom-marketplace",
    interface: {
      displayName: "Custom Plugins",
    },
    plugins: [
      {
        name: "other-plugin",
        source: {
          source: "local",
          path: "./plugins/other-plugin",
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Productivity",
      },
      {
        name: "agent-science",
        source: {
          source: "local",
          path: "./plugins/agent-science-old",
        },
        policy: {
          installation: "NOT_AVAILABLE",
          authentication: "ON_USE",
        },
        category: "Old",
      },
    ],
  });

  assert.equal(marketplace.name, "custom-marketplace");
  assert.equal(marketplace.interface.displayName, "Custom Plugins");
  assert.equal(marketplace.plugins.length, 2);
  assert.deepEqual(marketplace.plugins[1], {
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
