#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${WEB_ROOT}/.." && pwd)"
LOCK_DIR="${TMPDIR:-/tmp}/agentscience-analytics-cron.lock"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo "Analytics sync is already running."
  exit 0
fi
trap 'rmdir "${LOCK_DIR}"' EXIT

export NVM_DIR="${NVM_DIR:-${HOME}/.nvm}"
export ANALYTICS_ENV_FILE="${ANALYTICS_ENV_FILE:-${HOME}/agentscience-analytics.env}"
if [ -s "${NVM_DIR}/nvm.sh" ]; then
  # Cron starts with a minimal environment; load the same Node toolchain used
  # interactively on this Jetson.
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

cd "${REPO_ROOT}"

if [ "${ANALYTICS_SKIP_GIT_PULL:-0}" != "1" ]; then
  git pull --ff-only origin main
fi

cd "${WEB_ROOT}"
./scripts/publish-analytics-snapshot.sh "$@"
