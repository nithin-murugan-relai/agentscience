import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentInstallCommand,
  buildAgentInstallScript,
  buildClaudeCodeBootstrapInstructions,
  buildCodexBootstrapInstructions,
  buildOpenClawInstallCommand,
} from "@/lib/agent-installer";

test("buildAgentInstallCommand includes token and agent hint when provided", () => {
  const command = buildAgentInstallCommand({
    appOrigin: "https://agentscience.example/",
    token: "agsk_test",
    agent: "codex",
  });

  assert.match(command, /SIDEKICK_SOCIAL_BASE_URL='https:\/\/agentscience\.example'/);
  assert.match(command, /SIDEKICK_SOCIAL_AGENT_HINT='codex'/);
  assert.match(command, /SIDEKICK_SOCIAL_TOKEN='agsk_test'/);
  assert.match(command, /curl -fsSL 'https:\/\/agentscience\.example\/api\/agent\/install\?agent=codex'/);
});

test("buildOpenClawInstallCommand keeps the legacy OpenClaw hint", () => {
  const command = buildOpenClawInstallCommand({
    appOrigin: "https://agentscience.example",
  });

  assert.match(command, /SIDEKICK_SOCIAL_AGENT_HINT='openclaw'/);
  assert.doesNotMatch(command, /SIDEKICK_SOCIAL_TOKEN=/);
});

test("buildAgentInstallScript wires generic bootstrap with codex and claude-code branches", () => {
  const script = buildAgentInstallScript({
    appOrigin: "https://agentscience.example",
    agentHint: "auto",
  });

  assert.match(script, /AGENT_HINT="\$\{SIDEKICK_SOCIAL_AGENT_HINT:-auto\}"/);
  assert.match(script, /api\/v1\/auth\/device/);
  assert.match(script, /Installing Agent Science methodology as Codex skill/);
  assert.match(script, /Installing Agent Science methodology for Claude Code/);
  assert.match(script, /Configuring OpenClaw integration/);
  assert.match(script, /Start a new Codex thread/);
  assert.match(script, /Claude Code will load the Agent Science methodology/);
});

test("buildAgentInstallScript keeps the CLI-only fallback instructions", () => {
  const script = buildAgentInstallScript({
    appOrigin: "https://agentscience.example",
    agentHint: "auto",
  });

  assert.match(script, /No supported agent runtime detected/);
});

test("buildClaudeCodeBootstrapInstructions returns transparent step-by-step instructions", () => {
  const instructions = buildClaudeCodeBootstrapInstructions({
    appOrigin: "https://agentscience.example",
  });

  assert.match(instructions, /Agent Science.*Setup for Claude Code/);
  assert.match(instructions, /npm install -g agentscience/);
  assert.match(instructions, /api\/v1\/auth\/device/);
  assert.match(instructions, /api\/agent\/methodology/);
  assert.match(instructions, /CLAUDE\.md/);
});

test("buildCodexBootstrapInstructions returns plain-text with curl command", () => {
  const instructions = buildCodexBootstrapInstructions({
    appOrigin: "https://agentscience.example",
  });

  assert.match(instructions, /Install Agent Science/);
  assert.match(instructions, /SIDEKICK_SOCIAL_AGENT_HINT='codex'/);
});
