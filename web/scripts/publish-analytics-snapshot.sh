#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
export ANALYTICS_ENV_FILE="${ANALYTICS_ENV_FILE:-${HOME}/agentscience-analytics.env}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # Cron does not load the interactive shell where nvm is usually initialized.
  # shellcheck source=/dev/null
  . "${NVM_DIR}/nvm.sh"
  nvm use 20 >/dev/null
fi

for bin_dir in "${HOME}"/.nvm/versions/node/*/bin; do
  if [ -d "${bin_dir}" ]; then
    PATH="${PATH}:${bin_dir}"
  fi
done
export PATH

cd "${WEB_ROOT}"
SNAPSHOT_FILE="$(mktemp)"
trap 'rm -f "${SNAPSHOT_FILE}"' EXIT

npm run analytics:sync -- --out "${SNAPSHOT_FILE}" "$@"
node scripts/publish-analytics-snapshot.mjs "${SNAPSHOT_FILE}"
