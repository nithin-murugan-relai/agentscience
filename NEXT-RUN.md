# Round 4 runbook

Everything below is prepared and tested offline. Run it when the internet is stable.

## What changed and why

| Problem found on 2026-08-12 | Fix |
| --- | --- |
| Baseline already passed ~87%, so anchors carried almost no signal | New environment `cli-help-self-consistency` fails **deterministically** today |
| Decisions made on 1 rollout vs 1 rollout | Two environments per batch, and `--early-stop` dropped so the multi-run final evaluation actually runs |
| `--early-stop` silently skipped the final before/after eval | Never passed by the launcher |
| Clamshell sleep on battery killed two runs | Launcher refuses to start on battery |
| Network drop lost the PR and the backend upload | Launcher waits for a stable connection, then recovers the PR afterwards |

## Step 1 - commit the new environment and launcher

The env must be committed before it can be uploaded.

```bash
cd ~/developer/agentscience
git add .relai/learning-envs/cli-help-self-consistency.py run-optimize.sh NEXT-RUN.md
git commit -m "Add CLI self-documentation learning env and hardened optimize launcher"
git push
```

## Step 2 - register the environment with the backend

```bash
relai learning-env upload --learning-envs cli-help-self-consistency
```

## Step 3 - launch

```bash
sudo pmset -a disablesleep 1     # only if you plan to close the lid
./run-optimize.sh 45             # or 60 for more final-eval power
```

The launcher blocks until it has five consecutive successful network checks, so it is safe
to start it while the connection is still flaky.

Expect roughly 3 to 5 hours at 45 rollouts, based on ~7 minutes per rollout including
optimizer thinking time. 15 rollouts go to optimization and 30 to the final evaluation.

Afterwards:

```bash
sudo pmset -a disablesleep 0
```

## What to expect from the new environment

`cli-help-self-consistency` requires the agent to discover the tool through
`agentscience --help`, then checks that the help output only advertises research subcommands
the dispatcher actually implements.

Today it scores **67% on every run**, because `cli/bin/agentscience` line 136 advertises
`agentscience research run --idea ...` while the dispatcher answers
`Unknown research subcommand`. That failure is deterministic rather than sampled, so even a
single-rollout anchor is informative - which is what makes it useful despite the n=1 issue.

The scoring was verified offline against the CLI's real help text:

| Scenario | Score |
| --- | --- |
| Today's CLI | 67% |
| CLI help fixed | 100% |
| Agent skips help to dodge the check | 33% |
| Agent invokes the dead subcommand | 67% |

The only way to reach 100% is to edit the CLI's help text. A prompt change cannot do it,
and skipping help scores worse. This is the structural gradient that rounds 2 and 3 lacked.

## Reading the results

The dashboard is only trustworthy if the run's final upload succeeded. The launcher prints a
warning if it did not. Ground truth is local:

```bash
grep -aE "Evolution Step|-> |Final evaluation" optimize-<stamp>.log
ls .relai/observability-<stamp>/*/
```

Treat the **final evaluation** table as the result. Per-turn "67% -> 100%" lines are
single-rollout comparisons and should not be quoted externally.

## Still open

- Slack reply to Laurent is drafted but on hold pending these numbers.
- Yann still needs an invite to the RELAI project.
- Upstream bug report written: `~/developer/relai-cli-friction-2026-08-12.md`.
