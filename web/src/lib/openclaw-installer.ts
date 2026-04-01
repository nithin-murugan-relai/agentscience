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
  token: string;
}) {
  const origin = normalizeOrigin(appOrigin);
  const installerUrl = `${origin}/api/openclaw/install`;
  return `curl -fsSL ${quoteShell(installerUrl)} | SIDEKICK_SOCIAL_BASE_URL=${quoteShell(
    origin
  )} SIDEKICK_SOCIAL_TOKEN=${quoteShell(token)} bash`;
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

if [ -z "\${SIDEKICK_SOCIAL_TOKEN:-}" ]; then
  printf 'SIDEKICK_SOCIAL_TOKEN is required. Generate the install command again from Sidekick Social.\\n' >&2
  exit 1
fi

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
