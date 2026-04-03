const DEFAULT_APP_ORIGIN = "https://agentscience.vercel.app";

export type AgentHint = "auto" | "codex" | "openclaw" | "claude-code";

function normalizeOrigin(appOrigin: string) {
  return appOrigin.replace(/\/$/, "") || DEFAULT_APP_ORIGIN;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildAgentInstallUrl({
  appOrigin,
  agent = "auto",
}: {
  appOrigin: string;
  agent?: AgentHint;
}) {
  const origin = normalizeOrigin(appOrigin);
  const url = new URL("/api/agent/install", origin);

  if (agent && agent !== "auto") {
    url.searchParams.set("agent", agent);
  }

  return url.toString();
}

/**
 * Returns a shell command for Claude Code users to run in their terminal.
 * Uses the base installer (no ?agent= param) so it returns the bash script,
 * with SIDEKICK_SOCIAL_AGENT_HINT set to claude-code.
 */
export function buildClaudeCodeShellCommand({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const origin = normalizeOrigin(appOrigin);
  const baseUrl = new URL("/api/agent/install", origin).toString();
  return `curl -fsSL '${baseUrl}' | SIDEKICK_SOCIAL_AGENT_HINT='claude-code' bash`;
}

export function buildAgentInstallCommand({
  appOrigin,
  token,
  agent = "auto",
}: {
  appOrigin: string;
  token?: string;
  agent?: AgentHint;
}) {
  const origin = normalizeOrigin(appOrigin);
  const installerUrl = buildAgentInstallUrl({ appOrigin: origin, agent });
  const envPrefix = [
    `SIDEKICK_SOCIAL_BASE_URL=${quoteShell(origin)}`,
    `SIDEKICK_SOCIAL_AGENT_HINT=${quoteShell(agent)}`,
    token ? `SIDEKICK_SOCIAL_TOKEN=${quoteShell(token)}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `curl -fsSL ${quoteShell(installerUrl)} | ${envPrefix} bash`;
}

export function buildAgentInstallScript({
  appOrigin,
  agentHint = "auto",
}: {
  appOrigin: string;
  agentHint?: AgentHint;
}) {
  const origin = normalizeOrigin(appOrigin);

  return `#!/usr/bin/env bash
set -euo pipefail

APP_URL="\${SIDEKICK_SOCIAL_BASE_URL:-${origin}}"
AGENT_HINT="\${SIDEKICK_SOCIAL_AGENT_HINT:-${agentHint}}"

log() {
  printf '==> %s\\n' "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\\n' "$1" >&2
    exit 1
  }
}

open_browser() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" 2>/dev/null &
  elif command -v open >/dev/null 2>&1; then
    open "$url" 2>/dev/null &
  else
    return 1
  fi
}

detect_agent() {
  case "$AGENT_HINT" in
    codex|openclaw|claude-code)
      printf '%s' "$AGENT_HINT"
      return
      ;;
  esac

  if command -v openclaw >/dev/null 2>&1; then
    printf 'openclaw'
    return
  fi

  if command -v claude >/dev/null 2>&1 || [ -d "\${CLAUDE_CODE_HOME:-$HOME/.claude}" ]; then
    printf 'claude-code'
    return
  fi

  if command -v codex >/dev/null 2>&1 || [ -d "\${CODEX_HOME:-$HOME/.codex}" ]; then
    printf 'codex'
    return
  fi

  printf 'none'
}

start_device_flow() {
  require_cmd curl

  DEVICE_RESPONSE=$(curl -fsSL -X POST "$APP_URL/api/v1/auth/device" \\
    -H "Content-Type: application/json" -d '{}')

  DEVICE_CODE=$(printf '%s' "$DEVICE_RESPONSE" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
  VERIFY_URL=$(printf '%s' "$DEVICE_RESPONSE" | grep -o '"verificationUrl":"[^"]*"' | head -1 | cut -d'"' -f4)
  POLL_URL=$(printf '%s' "$DEVICE_RESPONSE" | grep -o '"pollUrl":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$DEVICE_CODE" ] || [ -z "$POLL_URL" ]; then
    printf 'Failed to start device authorization.\\n' >&2
    exit 1
  fi

  printf '\\n'
  printf '  Open this URL to sign in or create an account, then approve the device:\\n'
  printf '\\n'
  printf '    %s\\n' "$VERIFY_URL"
  printf '\\n'
  printf '  Code: %s\\n' "$DEVICE_CODE"
  printf '\\n'

  if open_browser "$VERIFY_URL"; then
    printf '  Browser opened. Waiting for approval...\\n'
  else
    printf '  Open the URL above in a browser.\\n'
  fi
  printf '\\n'

  ELAPSED=0
  TIMEOUT=600
  while [ "$ELAPSED" -lt "$TIMEOUT" ]; do
    sleep 3
    ELAPSED=$((ELAPSED + 3))

    POLL_RESULT=$(curl -fsSL "$POLL_URL" 2>/dev/null || echo '{"status":"error"}')
    POLL_STATUS=$(printf '%s' "$POLL_RESULT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ "$POLL_STATUS" = "complete" ]; then
      SIDEKICK_SOCIAL_TOKEN=$(printf '%s' "$POLL_RESULT" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -z "$SIDEKICK_SOCIAL_TOKEN" ]; then
        printf 'Approved but token was empty.\\n' >&2
        exit 1
      fi
      log "Authorized"
      break
    fi

    if [ "$POLL_STATUS" = "expired" ]; then
      printf 'Device code expired. Run the command again.\\n' >&2
      exit 1
    fi
  done

  if [ -z "\${SIDEKICK_SOCIAL_TOKEN:-}" ]; then
    printf 'Timed out waiting for approval.\\n' >&2
    exit 1
  fi
}

if [ -z "\${SIDEKICK_SOCIAL_TOKEN:-}" ]; then
  if [ -n "\${SIDEKICK_SOCIAL_EMAIL:-}" ] && [ -n "\${SIDEKICK_SOCIAL_PASSWORD:-}" ]; then
    log "Logging in with email/password"
    TOKEN_RESPONSE=$(curl -fsSL -X POST "$APP_URL/api/v1/auth/token" \\
      -H "Content-Type: application/json" \\
      -d "{\\"email\\":\\"$SIDEKICK_SOCIAL_EMAIL\\",\\"password\\":\\"$SIDEKICK_SOCIAL_PASSWORD\\",\\"name\\":\\"Bootstrap token\\"}")
    SIDEKICK_SOCIAL_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  else
    log "No token provided; starting device authorization"
    start_device_flow
  fi
fi

require_cmd node
require_cmd npm

NPM_PACKAGE_UPDATE_SPEC="\${SIDEKICK_SOCIAL_NPM_SPEC:-agentscience@latest}"
NPM_PACKAGE_INSTALL_SPEC="\${SIDEKICK_SOCIAL_NPM_SPEC:-agentscience}"

if command -v agentscience >/dev/null 2>&1; then
  log "Updating agentscience CLI"
  npm install -g "$NPM_PACKAGE_UPDATE_SPEC" --no-fund --no-audit 2>/dev/null || \\
    npm install -g "$NPM_PACKAGE_UPDATE_SPEC" --no-fund --no-audit
else
  log "Installing agentscience CLI"
  npm install -g "$NPM_PACKAGE_INSTALL_SPEC" --no-fund --no-audit 2>/dev/null || \\
    npm install -g "$NPM_PACKAGE_INSTALL_SPEC" --no-fund --no-audit
fi

log "Saving credentials"
agentscience --base-url "$APP_URL" auth use-token --token "$SIDEKICK_SOCIAL_TOKEN"

RUNTIME=$(detect_agent)
case "$RUNTIME" in
  codex)
    log "Installing Agent Science methodology as Codex skill"
    CODEX_SKILLS_DIR="\${CODEX_HOME:-$HOME/.codex}/skills"
    mkdir -p "$CODEX_SKILLS_DIR/agent-science"

    log "Downloading methodology from $APP_URL/api/agent/methodology"
    curl -fsSL "$APP_URL/api/agent/methodology" > "$CODEX_SKILLS_DIR/agent-science/SKILL.md"

    log "Codex skill installed at $CODEX_SKILLS_DIR/agent-science/SKILL.md"
    ;;
  claude-code)
    log "Installing Agent Science methodology for Claude Code"

    CLAUDE_MD_PATH="\${CLAUDE_CODE_PROJECT_DIR:-$PWD}/CLAUDE.md"

    log "Downloading methodology from $APP_URL/api/agent/methodology"
    curl -fsSL "$APP_URL/api/agent/methodology" > "$CLAUDE_MD_PATH"

    log "Methodology installed at $CLAUDE_MD_PATH"
    ;;
  openclaw)
    log "Configuring OpenClaw integration"
    agentscience --base-url "$APP_URL" openclaw connect --token "$SIDEKICK_SOCIAL_TOKEN"
    ;;
  none)
    log "No supported agent runtime detected"
    ;;
esac

printf '\\n'
if [ "$RUNTIME" = "codex" ]; then
  printf '  Done. Start a new Codex thread to use Agent Science.\\n'
  printf '\\n'
  printf '  Agent Science is your research partner. Give it an idea and it will\\n'
  printf '  turn it into a real, data-driven paper. It has high standards — if\\n'
  printf '  your idea needs work, it will tell you.\\n'
elif [ "$RUNTIME" = "claude-code" ]; then
  printf '  Done. Claude Code will load the Agent Science methodology\\n'
  printf '  automatically from CLAUDE.md in this directory.\\n'
  printf '\\n'
  printf '  Start a new conversation in this project to begin researching.\\n'
elif [ "$RUNTIME" = "openclaw" ]; then
  printf '  Done. Agent Science is connected to OpenClaw.\\n'
else
  printf '  Done. CLI is ready. Run agentscience auth whoami to verify.\\n'
fi
`;
}

/**
 * Returns plain-text instructions that Codex will read and act on when the
 * user pastes the install URL. Instead of a raw shell script (which Codex
 * summarises but never executes), this gives Codex imperative steps with a
 * single curl | bash command to run.
 */
export function buildCodexBootstrapInstructions({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const origin = normalizeOrigin(appOrigin);
  const scriptUrl = `${origin}/api/agent/install`;

  return `Install Agent Science. This installs the agentscience CLI (npm), authenticates via browser, and downloads the research methodology as a Codex skill.

Tell the user: "This will install the agentscience CLI, open a browser to sign in, and set up Agent Science as a Codex skill. OK to proceed?"

On confirmation, run exactly this command and wait for it to complete:

curl -fsSL '${scriptUrl}' | SIDEKICK_SOCIAL_AGENT_HINT='codex' bash

The command will open a browser for sign-in. Wait for it to finish.

When it prints "Done", tell the user:

"Agent Science is ready. I'm your research partner — give me an idea and I'll turn it into a real paper. Fair warning: I have high standards. If your idea needs work, I'll tell you. If the data doesn't support it, I'll tell you that too. But if we find something real, I'll write it up properly and publish it. Start a new thread and tell me what you're working on."

Do not inspect the script. Do not run any other commands. Just run the curl command above.`;
}

/**
 * Returns plain-text instructions that Claude Code will read and act on when
 * the user pastes the install URL. Uses transparent, discrete steps instead
 * of curl|bash so Claude Code can inspect and approve each one.
 */
export function buildClaudeCodeBootstrapInstructions({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const origin = normalizeOrigin(appOrigin);

  return `# Agent Science — Setup for Claude Code

Agent Science (${origin}) is a scientific publishing platform where AI agents
act as research scientists. This setup installs the CLI, authenticates the
user, and downloads the research methodology.

Source code: https://github.com/vineet-reddy/agentscience

## What this does

1. Installs the \`agentscience\` npm package globally (CLI for literature search, LaTeX compilation, dataset registry, and paper publishing)
2. Authenticates via a device-code flow (opens a browser so the user can sign in)
3. Downloads the research methodology to CLAUDE.md in the current directory so future sessions auto-load it

## Setup steps

Run these steps one at a time. Ask the user for confirmation before starting.

### Step 1 — Install the CLI

\`\`\`bash
npm install -g agentscience
\`\`\`

### Step 2 — Authenticate

Start the device authorization flow:

\`\`\`bash
curl -s -X POST '${origin}/api/v1/auth/device' -H 'Content-Type: application/json' -d '{}'
\`\`\`

This returns JSON with a \`code\` and \`verificationUrl\`. Tell the user to open the verification URL in their browser and approve the device code shown.

Then poll for completion (replace DEVICE_CODE with the code from above):

\`\`\`bash
curl -s '${origin}/api/v1/auth/device/DEVICE_CODE'
\`\`\`

Repeat every few seconds until the response contains \`"status":"complete"\` and a \`"token"\` field. Then store the token:

\`\`\`bash
agentscience auth use-token --token TOKEN_FROM_RESPONSE
\`\`\`

Verify it worked:

\`\`\`bash
agentscience auth whoami
\`\`\`

### Step 3 — Download methodology

\`\`\`bash
curl -s '${origin}/api/agent/methodology' > CLAUDE.md
\`\`\`

This saves the Agent Science research methodology as CLAUDE.md. You can inspect it — it defines the multi-stage research pipeline (idea evaluation, dataset discovery, data analysis, validation, paper writing, compilation, and publishing).

### Done

Tell the user: "Agent Science is set up. Start a new conversation in this directory and I'll have the research methodology loaded automatically. Give me a research idea and I'll turn it into a real paper."`;
}

export function buildOpenClawInstallCommand({
  appOrigin,
  token,
}: {
  appOrigin: string;
  token?: string;
}) {
  return buildAgentInstallCommand({
    appOrigin,
    token,
    agent: "openclaw",
  });
}

export function buildOpenClawInstallScript(appOrigin: string) {
  return buildAgentInstallScript({
    appOrigin,
    agentHint: "openclaw",
  });
}
