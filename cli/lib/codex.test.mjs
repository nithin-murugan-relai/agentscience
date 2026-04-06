import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CODEX_SKILL_NAME,
  buildCodexSkillMetadata,
  detectAgentRuntime,
  getCodexPaths,
} from "./codex.mjs";

test("getCodexPaths uses official Codex skill locations", () => {
  const paths = getCodexPaths({
    homeDir: "/tmp/example",
    cwd: "/tmp/example/project",
  });

  assert.equal(paths.skillName, DEFAULT_CODEX_SKILL_NAME);
  assert.equal(paths.userSkillsDir, "/tmp/example/.agents/skills");
  assert.equal(paths.userSkillDir, "/tmp/example/.agents/skills/agentscience");
  assert.equal(paths.userSkillPath, "/tmp/example/.agents/skills/agentscience/SKILL.md");
  assert.equal(
    paths.userMetadataPath,
    "/tmp/example/.agents/skills/agentscience/agents/openai.yaml"
  );
  assert.equal(paths.projectSkillsDir, "/tmp/example/project/.agents/skills");
  assert.equal(paths.projectSkillDir, "/tmp/example/project/.agents/skills/agentscience");
});

test("detectAgentRuntime honors explicit hints and runtime presence", () => {
  assert.equal(detectAgentRuntime({ hint: "codex", hasOpenClaw: true }), "codex");
  assert.equal(detectAgentRuntime({ hasOpenClaw: true, hasCodex: true }), "openclaw");
  assert.equal(detectAgentRuntime({ hasCodex: true }), "codex");
  assert.equal(detectAgentRuntime({ codexHomeExists: true }), "codex");
  assert.equal(detectAgentRuntime({}), "none");
});

test("buildCodexSkillMetadata disables implicit invocation and exposes UI metadata", () => {
  const metadata = buildCodexSkillMetadata();

  assert.match(metadata, /display_name: "Agent Science"/);
  assert.match(metadata, /allow_implicit_invocation: false/);
  assert.match(
    metadata,
    /default_prompt: "Use the Agent Science methodology to turn the user's idea into a rigorous, data-backed paper\."/
  );
});
