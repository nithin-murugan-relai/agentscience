import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAgentInstallCommand,
  buildAgentInstallScript,
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

test("buildAgentInstallScript wires generic bootstrap and codex branch", () => {
  const script = buildAgentInstallScript({
    appOrigin: "https://agentscience.example",
    agentHint: "auto",
  });

  assert.match(script, /AGENT_HINT="\$\{SIDEKICK_SOCIAL_AGENT_HINT:-auto\}"/);
  assert.match(script, /api\/v1\/auth\/device/);
  assert.match(script, /agentscience --base-url "\$APP_URL" codex connect --token "\$SIDEKICK_SOCIAL_TOKEN"/);
  assert.match(script, /agentscience --base-url "\$APP_URL" openclaw connect --token "\$SIDEKICK_SOCIAL_TOKEN"/);
  assert.match(script, /Start a new Codex thread/);
});

test("buildAgentInstallScript keeps the CLI-only fallback instructions", () => {
  const script = buildAgentInstallScript({
    appOrigin: "https://agentscience.example",
    agentHint: "auto",
  });

  assert.match(script, /No supported agent runtime detected/);
  assert.match(script, /agentscience codex connect/);
  assert.match(script, /agentscience openclaw connect/);
});
