import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentInstallCommand,
  buildAgentInstallScript,
  buildClaudeCodeBootstrapInstructions,
  buildCodexBootstrapInstructions,
} from "@/lib/agent-installer";

test("buildAgentInstallCommand includes token and agent hint when provided", () => {
  const command = buildAgentInstallCommand({
    appOrigin: "https://agentscience.example/",
    token: "agsk_test",
    agent: "codex",
  });

  assert.match(command, /AGENTSCIENCE_BASE_URL='https:\/\/agentscience\.example'/);
  assert.match(command, /AGENTSCIENCE_AGENT_HINT='codex'/);
  assert.match(command, /AGENTSCIENCE_TOKEN='agsk_test'/);
  assert.match(command, /curl -fsSL 'https:\/\/agentscience\.example\/api\/agent\/install\?agent=codex'/);
});

test("buildAgentInstallScript wires generic bootstrap with codex and claude-code branches", () => {
  const script = buildAgentInstallScript({
    appOrigin: "https://agentscience.example",
    agentHint: "auto",
  });

  assert.match(script, /AGENT_HINT="\$\{AGENTSCIENCE_AGENT_HINT:-auto\}"/);
  assert.match(script, /api\/v1\/auth\/device/);
  assert.match(script, /Installing Agent Science as a Codex skill/);
  assert.match(script, /\.agents\/skills/);
  assert.match(script, /CODEX_SKILL_DIR="\$CODEX_SKILLS_DIR\/agentscience"/);
  assert.match(script, /allow_implicit_invocation: false/);
  assert.match(script, /Installing \/agentscience slash command for Claude Code/);
  assert.match(script, /run \/skills and choose agentscience/);
  assert.match(script, /agentscience research init --idea/);
  assert.match(script, /default sandbox/);
  assert.match(script, /Enable Claude Code sandbox mode/);
  assert.match(script, /\/agentscience slash command is now available/);
  assert.match(script, /\.claude\/commands/);
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
  assert.match(instructions, /\.claude\/commands\/agentscience\.md/);
  assert.match(instructions, /enable Claude Code sandbox mode/i);
  assert.match(instructions, /agentscience research init --idea/);
});

test("buildCodexBootstrapInstructions returns transparent Codex skill setup instructions", () => {
  const instructions = buildCodexBootstrapInstructions({
    appOrigin: "https://agentscience.example",
  });

  assert.match(instructions, /Agent Science.*Setup for Codex/);
  assert.match(instructions, /npm install -g agentscience/);
  assert.match(instructions, /agentscience setup codex --author-name/);
  assert.match(instructions, /~\/\.agents\/skills\/agentscience\//);
  assert.match(instructions, /default sandbox/i);
  assert.match(instructions, /agentscience research init --idea/);
  assert.match(instructions, /\/skills and choose agentscience/);
});
