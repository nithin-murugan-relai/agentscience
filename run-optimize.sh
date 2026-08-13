#!/usr/bin/env bash
# Hardened launcher for `relai optimize` on agentscience.
#
# Encodes every failure mode we hit on 2026-08-09 and 2026-08-12:
#   - clamshell sleep on battery killed two runs      -> require AC + sleep disabled
#   - network drop at the end lost the PR and upload  -> wait for stable net, recover after
#   - --early-stop silently skipped the final eval    -> never pass it
#   - single noisy env made anchors uninformative     -> run both envs
#
# Usage: ./run-optimize.sh [total_rollouts]        (default 45)

set -uo pipefail

REPO="$HOME/developer/agentscience"
ROLLOUTS="${1:-45}"
ENVS="pipeline-supported-subcommands,cli-help-self-consistency"
STAMP="$(date +%Y%m%d-%H%M%S)"
OBS_DIR=".relai/observability-$STAMP"
LOG="$REPO/optimize-$STAMP.log"

cd "$REPO" || { echo "cannot cd to $REPO"; exit 1; }

say() { printf '\n=== %s ===\n' "$1"; }
fail() { printf '\nABORT: %s\n' "$1"; exit 1; }

say "Preflight"

# --- power: the thing that killed two runs -----------------------------------
if ! pmset -g batt | grep -q "AC Power"; then
  fail "on battery. Plug in first - caffeinate cannot stop clamshell sleep on battery."
fi
echo "ok   on AC power"

if [ "$(pmset -g | awk '/SleepDisabled/{print $2}')" != "1" ]; then
  echo "warn sleep is NOT disabled. If you will close the lid, run:"
  echo "       sudo pmset -a disablesleep 1     (undo later with ... 0)"
else
  echo "ok   sleep disabled (lid can be closed)"
fi

# --- network: must be stable, not just up ------------------------------------
say "Waiting for stable internet (5 consecutive checks, 10s apart)"
streak=0
until [ "$streak" -ge 5 ]; do
  if curl -sf -m 8 -o /dev/null https://api.relai.ai/ 2>/dev/null \
     || curl -sf -m 8 -o /dev/null https://github.com 2>/dev/null; then
    streak=$((streak + 1))
    echo "  reachable ($streak/5)"
  else
    [ "$streak" -gt 0 ] && echo "  dropped, restarting streak"
    streak=0
  fi
  [ "$streak" -ge 5 ] || sleep 10
done
echo "ok   network stable"

# --- repo state ---------------------------------------------------------------
say "Repo state"
if [ -n "$(git status --porcelain -- ':(exclude)*.pyc' | grep -v '^??')" ]; then
  git status --short -- ':(exclude)*.pyc' | grep -v '^??'
  fail "tracked files are modified. Commit or restore them first."
fi
echo "ok   working tree clean (branch $(git rev-parse --abbrev-ref HEAD))"

for env_id in ${ENVS//,/ }; do
  path=".relai/learning-envs/$env_id.py"
  [ -f "$path" ] || fail "missing $path"
  if ! git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    fail "$path is untracked. Commit it, then run: relai learning-env upload --learning-envs $env_id"
  fi
  echo "ok   $env_id committed"
done

# --- launch --------------------------------------------------------------------
say "Launching optimize ($ROLLOUTS rollouts, envs: $ENVS)"
echo "log: $LOG"
echo "artifacts: $OBS_DIR"
echo "NOTE: --early-stop is deliberately omitted so the final before/after evaluation runs."

caffeinate -dimsu relai optimize \
  --learning-envs "$ENVS" \
  --total-rollouts "$ROLLOUTS" \
  --verbosity debug \
  --emit-events-jsonl \
  --observability-dir "$OBS_DIR" \
  >"$LOG" 2>&1
status=$?
echo "relai optimize exited with $status" | tee -a "$LOG"

# --- recovery: the CLI does not retry PR creation or result upload -------------
say "Post-run recovery check"

branch=$(git branch --list 'relai/optimizer/*' --sort=-committerdate | head -1 | tr -d ' +*')
if [ -z "$branch" ]; then
  echo "no optimizer branch was created (no changes accepted, or the run died early)"
  exit "$status"
fi
echo "optimizer branch: $branch"

if grep -q "Optimizer PR not created\|could not inspect origin" "$LOG"; then
  echo "PR creation failed during the run - recovering now"
  desc=$(ls -t "$OBS_DIR"/*/pr-description.md 2>/dev/null | head -1)
  if git push -u origin "$branch" 2>&1 | tail -2; then
    if [ -n "$desc" ]; then
      gh pr create --base main --head "$branch" \
        --title "[RELAI optimized] $(date +%Y-%m-%d) optimizer run" \
        --body-file "$desc" 2>&1 | tail -2
    else
      echo "no pr-description.md found; branch pushed, create the PR manually"
    fi
  fi
else
  echo "ok   PR step succeeded during the run"
fi

if grep -q "Optimization result upload failed\|result upload skipped" "$LOG"; then
  echo "WARNING: the backend never received this run, so platform.relai.ai will NOT show it."
  echo "         Local artifacts are intact in $OBS_DIR (events.jsonl, optimization-report.json,"
  echo "         pr-description.md). Quote those, not the dashboard."
else
  echo "ok   backend received the optimization result"
fi

say "Done"
echo "Scores:   grep -aE 'Evolution Step|-> |Final evaluation' $LOG"
echo "Events:   $OBS_DIR/*/events.jsonl"
exit "$status"
