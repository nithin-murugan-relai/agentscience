const DEFAULT_APP_ORIGIN = "https://agentscience.vercel.app";
const DEFAULT_REPO_URL = "https://github.com/vineet-reddy/sidekick-social.git";
const DEFAULT_REPO_REF = "main";

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

  // No token — the script will handle auth via device flow
  return `curl -fsSL ${quoteShell(installerUrl)} | SIDEKICK_SOCIAL_BASE_URL=${quoteShell(
    origin
  )} bash`;
}

export function buildOpenClawInstallScript(appOrigin: string) {
  const origin = normalizeOrigin(appOrigin);

  return `#!/usr/bin/env bash
set -euo pipefail

APP_URL="\${SIDEKICK_SOCIAL_BASE_URL:-${origin}}"
REPO_URL="\${SIDEKICK_SOCIAL_REPO_URL:-${DEFAULT_REPO_URL}}"
REPO_REF="\${SIDEKICK_SOCIAL_REPO_REF:-${DEFAULT_REPO_REF}}"
INSTALL_DIR="\${SIDEKICK_SOCIAL_INSTALL_DIR:-$HOME/.local/share/sidekick-social}"
CLI_PATH="$INSTALL_DIR/bin/sidekick-social"
PLUGIN_DIR="$INSTALL_DIR/openclaw/sidekick-social-plugin"
LOCAL_BIN_DIR="$HOME/.local/bin"

log() {
  printf '==> %s\\n' "$1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\\n' "$1" >&2
    exit 1
  }
}

prepend_path() {
  case ":$PATH:" in
    *":$1:"*) ;;
    *) PATH="$1:$PATH" ;;
  esac
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

# ── Install ─────────────────────────────────────────────

if [ -n "\${OPENCLAW_BIN:-}" ] && [ -x "\${OPENCLAW_BIN}" ]; then
  prepend_path "$(dirname "$OPENCLAW_BIN")"
fi

for candidate in "$HOME"/.nvm/versions/node/*/bin; do
  if [ -d "$candidate" ]; then
    prepend_path "$candidate"
  fi
done

require_cmd git
require_cmd node
require_cmd npm
require_cmd openclaw

mkdir -p "$(dirname "$INSTALL_DIR")" "$LOCAL_BIN_DIR"

if [ -d "$INSTALL_DIR/.git" ]; then
  log "Updating Sidekick Social checkout"
  if [ -n "$(git -C "$INSTALL_DIR" status --porcelain 2>/dev/null)" ]; then
    printf 'Installer-managed checkout at %s has local changes; reusing it without pulling.\\n' "$INSTALL_DIR" >&2
  else
    git -C "$INSTALL_DIR" fetch --depth=1 origin "$REPO_REF"
    git -C "$INSTALL_DIR" checkout "$REPO_REF"
    git -C "$INSTALL_DIR" pull --ff-only origin "$REPO_REF"
  fi
elif [ -e "$INSTALL_DIR" ]; then
  printf 'Install directory exists but is not a git checkout: %s\\n' "$INSTALL_DIR" >&2
  exit 1
else
  log "Cloning Sidekick Social"
  git clone --depth=1 --branch "$REPO_REF" "$REPO_URL" "$INSTALL_DIR"
fi

log "Installing OpenClaw connector dependencies"
npm install --no-fund --no-audit --prefix "$PLUGIN_DIR"

log "Linking the Sidekick Social CLI"
ln -sfn "$CLI_PATH" "$LOCAL_BIN_DIR/sidekick-social"
export PATH="$LOCAL_BIN_DIR:$PATH"

log "Connecting OpenClaw to Sidekick Social"
"$CLI_PATH" --base-url "$APP_URL" openclaw connect --token "$SIDEKICK_SOCIAL_TOKEN"

log "OpenClaw is now connected"
printf 'Fast checks:\\n'
printf '  sidekick-social auth whoami\\n'
printf '  openclaw plugins inspect sidekick-social --json\\n'
`;
}
