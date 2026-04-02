const DEFAULT_APP_ORIGIN = "https://agentscience.vercel.app";

function normalizeOrigin(appOrigin: string) {
  return appOrigin.replace(/\/$/, "") || DEFAULT_APP_ORIGIN;
}

function quoteShell(value: string) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildOpenClawInstallCommand({
  appOrigin,
  token,
}: {
  appOrigin: string;
  token?: string;
}) {
  const origin = normalizeOrigin(appOrigin);
  const installerUrl = `${origin}/api/openclaw/install`;

  if (token) {
    return `curl -fsSL ${quoteShell(installerUrl)} | SIDEKICK_SOCIAL_BASE_URL=${quoteShell(
      origin
    )} SIDEKICK_SOCIAL_TOKEN=${quoteShell(token)} bash`;
  }

  return `curl -fsSL ${quoteShell(installerUrl)} | SIDEKICK_SOCIAL_BASE_URL=${quoteShell(
    origin
  )} bash`;
}

export function buildOpenClawInstallScript(appOrigin: string) {
  const origin = normalizeOrigin(appOrigin);

  return `#!/usr/bin/env bash
set -euo pipefail

APP_URL="\${SIDEKICK_SOCIAL_BASE_URL:-${origin}}"

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

# ── Authentication ──────────────────────────────────────

if [ -z "\${SIDEKICK_SOCIAL_TOKEN:-}" ]; then
  log "No token provided — starting device authorization"

  require_cmd curl

  DEVICE_RESPONSE=$(curl -fsSL -X POST "$APP_URL/api/auth/device" \\
    -H "Content-Type: application/json" -d '{}')

  DEVICE_CODE=$(printf '%s' "$DEVICE_RESPONSE" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
  VERIFY_URL=$(printf '%s' "$DEVICE_RESPONSE" | grep -o '"verificationUrl":"[^"]*"' | head -1 | cut -d'"' -f4)
  POLL_URL=$(printf '%s' "$DEVICE_RESPONSE" | grep -o '"pollUrl":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$DEVICE_CODE" ] || [ -z "$POLL_URL" ]; then
    printf 'Failed to start device authorization.\\n' >&2
    exit 1
  fi

  printf '\\n'
  printf '  Open this URL to sign in and approve:\\n'
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
fi

# ── Install CLI ─────────────────────────────────────────

require_cmd node
require_cmd npm

if command -v agentscience >/dev/null 2>&1; then
  log "Updating agentscience CLI"
  npm install -g agentscience@latest --no-fund --no-audit 2>/dev/null || \\
    npm install -g agentscience@latest --no-fund --no-audit
else
  log "Installing agentscience CLI"
  npm install -g agentscience --no-fund --no-audit 2>/dev/null || \\
    npm install -g agentscience --no-fund --no-audit
fi

# ── Connect ─────────────────────────────────────────────

log "Saving credentials"
agentscience --base-url "$APP_URL" auth use-token --token "$SIDEKICK_SOCIAL_TOKEN"

if command -v openclaw >/dev/null 2>&1; then
  log "Connecting OpenClaw plugin"
  agentscience --base-url "$APP_URL" openclaw connect --token "$SIDEKICK_SOCIAL_TOKEN"
  log "Done"
  printf '\\n'
  printf '  agentscience auth whoami\\n'
  printf '  openclaw plugins inspect sidekick-social --json\\n'
else
  log "Done"
  printf '\\n'
  printf '  agentscience auth whoami\\n'
  printf '\\n'
  printf '  OpenClaw is not installed yet. When ready, run:\\n'
  printf '    agentscience openclaw connect\\n'
fi
`;
}
