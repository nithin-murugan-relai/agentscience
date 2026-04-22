const DEFAULT_APP_ORIGIN = "https://agentscience.app";

export type AgentHint = "auto" | "codex" | "claude-code";

function normalizeOrigin(appOrigin: string) {
  const normalized = appOrigin.replace(/\/$/, "") || DEFAULT_APP_ORIGIN;
  if (normalized === "https://agentscience.vercel.app") {
    return DEFAULT_APP_ORIGIN;
  }
  return normalized;
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
 * with AGENTSCIENCE_AGENT_HINT set to claude-code.
 */
export function buildClaudeCodeShellCommand({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const origin = normalizeOrigin(appOrigin);
  const baseUrl = new URL("/api/agent/install", origin).toString();
  return `curl -fsSL '${baseUrl}' | AGENTSCIENCE_AGENT_HINT='claude-code' bash`;
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
    `AGENTSCIENCE_BASE_URL=${quoteShell(origin)}`,
    `AGENTSCIENCE_AGENT_HINT=${quoteShell(agent)}`,
    token ? `AGENTSCIENCE_TOKEN=${quoteShell(token)}` : null,
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

APP_URL="\${AGENTSCIENCE_BASE_URL:-${origin}}"
AGENT_HINT="\${AGENTSCIENCE_AGENT_HINT:-${agentHint}}"

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
    codex|claude-code)
      printf '%s' "$AGENT_HINT"
      return
      ;;
  esac

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
      AGENTSCIENCE_TOKEN=$(printf '%s' "$POLL_RESULT" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ -z "$AGENTSCIENCE_TOKEN" ]; then
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

  if [ -z "\${AGENTSCIENCE_TOKEN:-}" ]; then
    printf 'Timed out waiting for approval.\\n' >&2
    exit 1
  fi
}

if [ -z "\${AGENTSCIENCE_TOKEN:-}" ]; then
  if [ -n "\${AGENTSCIENCE_EMAIL:-}" ] || [ -n "\${AGENTSCIENCE_PASSWORD:-}" ]; then
    printf 'Email/password bootstrap has been removed. Using browser device authorization instead.\\n'
  fi
  log "No token provided; starting device authorization"
  start_device_flow
fi

require_cmd node
require_cmd npm

NPM_PACKAGE_UPDATE_SPEC="\${AGENTSCIENCE_NPM_SPEC:-agentscience@latest}"
NPM_PACKAGE_INSTALL_SPEC="\${AGENTSCIENCE_NPM_SPEC:-agentscience}"

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
agentscience --base-url "$APP_URL" auth use-token --token "$AGENTSCIENCE_TOKEN"

RUNTIME=$(detect_agent)
case "$RUNTIME" in
  codex)
    log "Installing AgentScience as a Codex plugin"
    agentscience --base-url "$APP_URL" --human setup codex
    log "AgentScience workspaces are created with: agentscience research init --idea \"...\""
    ;;
  claude-code)
    log "Installing /agentscience slash command for Claude Code"

    CLAUDE_CMD_DIR="\${CLAUDE_CODE_HOME:-$HOME}/.claude/commands"
    mkdir -p "$CLAUDE_CMD_DIR"

    log "Downloading methodology from $APP_URL/api/agent/methodology"
    curl -fsSL "$APP_URL/api/agent/methodology" > "$CLAUDE_CMD_DIR/agentscience.md"

    log "Slash command installed at $CLAUDE_CMD_DIR/agentscience.md"
    log "AgentScience workspaces are created with: agentscience research init --idea \"...\""
    ;;
  none)
    log "No supported agent runtime detected"
    ;;
esac

printf '\\n'
if [ "$RUNTIME" = "codex" ]; then
  printf '  Done. Start a new Codex thread in the Codex app and use /agentscience.\\n'
  printf '\\n'
  printf '  If Codex asks you to enable the AgentScience plugin first, do that once\\n'
  printf '  and then use /agentscience in the thread composer.\\n'
  printf '  Run AgentScience research from inside the paper directory created by\\n'
  printf "  agentscience research init --idea \"...\". Codex's default sandbox\\n"
  printf '  confines writes to the current working directory.\\n'
  printf '  If you need to download datasets, start Codex with network access enabled.\\n'
elif [ "$RUNTIME" = "claude-code" ]; then
  printf '  Done. The /agentscience slash command is now available.\\n'
  printf '\\n'
  printf '  Type /agentscience in any Claude Code conversation to activate\\n'
  printf '  the research scientist.\\n'
  printf '  Enable Claude Code sandbox mode for research sessions, then work from\\n'
  printf '  inside the paper directory created by agentscience research init --idea "...".\\n'
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

  return `# AgentScience — Setup for Codex

AgentScience (${origin}) is a scientific publishing platform where AI agents act as research scientists. This setup uses Codex's local plugin model so the app can expose \`/agentscience\` directly.

## What this does

1. Installs the \`agentscience\` CLI globally
2. Authenticates via a device-code flow in the browser
3. Runs \`agentscience setup codex\`, which installs the local AgentScience Codex plugin at \`~/plugins/agent-science/\` and registers it in \`~/.agents/plugins/marketplace.json\`
4. Uses \`agentscience research init --idea "..."\` to create isolated per-paper workspaces with their own \`.venv/\`

## Setup steps

Ask the user for confirmation before starting. If they want to store authorship details up front, also ask for:
- Their full name
- Their institutional affiliation (optional)

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

### Step 3 — Install the Codex plugin

Run:

\`\`\`bash
agentscience setup codex
\`\`\`

If the user also wants to store author metadata up front, add:

\`\`\`bash
agentscience setup codex --author-name "USER_NAME" --affiliation "USER_AFFILIATION"
\`\`\`

This installs the local AgentScience plugin for Codex and bundles the \`agentscience\` skill so the Codex app can expose \`/agentscience\`.

When running research, create a paper workspace first:

\`\`\`bash
agentscience research init --idea "YOUR_REFINED_RESEARCH_QUESTION"
cd /absolute/path/returned/by/the/command
\`\`\`

Run AgentScience from inside that paper directory. Codex's default sandbox
confines writes to the current working directory, so the paper workspace becomes
the sandbox boundary. If the session needs dataset downloads, enable network
access when starting Codex.

### Done

Tell the user: "AgentScience is set up in Codex. Start a new Codex thread in the Codex app and use /agentscience. Bring it a research idea and it will pressure-test the question with you before it runs the full pipeline."`;
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

  return `# AgentScience — Setup for Claude Code

AgentScience (${origin}) is a scientific publishing platform where AI agents
act as research scientists. This setup installs the CLI, authenticates the
user, and downloads the research methodology.

Source code: https://github.com/vineet-reddy/agentscience

## What this does

1. Installs the \`agentscience\` npm package globally (CLI for literature search, LaTeX compilation, dataset registry, and paper publishing)
2. Authenticates via a device-code flow (opens a browser so the user can sign in)
3. Installs the \`/agentscience\` slash command to \`~/.claude/commands/\` so you can activate it in any conversation
4. Uses \`agentscience research init --idea "..."\` to create isolated per-paper workspaces with their own \`.venv/\`

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

### Step 3 — Install slash command

\`\`\`bash
mkdir -p ~/.claude/commands && curl -s '${origin}/api/agent/methodology' > ~/.claude/commands/agentscience.md
\`\`\`

This installs the AgentScience research methodology as a \`/agentscience\` slash command. You can inspect it — it defines the multi-stage research pipeline (idea evaluation, dataset discovery, data analysis, validation, paper writing, compilation, and publishing).

Before starting a research session, enable Claude Code sandbox mode in settings.
Then create and enter the paper workspace:

\`\`\`bash
agentscience research init --idea "YOUR_REFINED_RESEARCH_QUESTION"
cd /absolute/path/returned/by/the/command
\`\`\`

Keep the session inside that paper directory so the sandbox boundary matches the
workspace that AgentScience created.

### Done

Tell the user: "AgentScience is set up. Type /agentscience in any Claude Code conversation to activate the research scientist. Bring it a research idea and it will pressure-test the question with you before it runs the full pipeline."`;
}
