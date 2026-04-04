# TODO

## Dataset Registry Self-Improvement

- When a paper passes validation and the agent confirms it used a quality dataset, prompt the user to add that dataset to the registry as part of the publish flow. This creates a self-improving network: every good paper enriches the registry with niche datasets, making future research stronger. The flow would be:
  1. Agent completes a paper and identifies the dataset(s) used
  2. Agent checks if those datasets are already in the registry
  3. If not, agent proposes adding them (name, URL, description, domain, keywords) and asks the user for confirmation
  4. On confirmation, `agentscience registry add` is called automatically as part of the publish step
- This should be wired into the methodology (Stage 4 - Compile and Publish) and the CLI publish flow

## Codex: First-Class Slash Command Interface (Let Codex Build Itself)

Claude Code now has a `/agentscience` slash command that turns it into a research scientist on demand. Codex needs the same treatment. Claude Code built its own integration because it knows itself best — Codex should do the same.

### What Claude Code Has (the reference implementation)

- **Slash command**: `~/.claude/commands/agentscience.md` — a markdown file with YAML frontmatter (`name`, `description`) followed by the full research methodology. User types `/agentscience` in any conversation to activate.
- **Setup command**: `agentscience setup claude-code` installs the CLI, authenticates via device flow, and downloads the methodology from `https://agentscience.vercel.app/api/agent/methodology` into `~/.claude/commands/agentscience.md`.
- **Flags**: `--project` (install to `.claude/commands/` in cwd instead of user-level), `--uninstall` (remove the command file).
- **Connect page** (`web/src/app/connect/page.tsx`): Shows a copy-paste command `npm install -g agentscience && agentscience setup claude-code`.
- **Key insight**: The slash command is toggle-able — users activate it per-conversation rather than having it always loaded.

### What Codex Has Today (incomplete)

- **Codex plugin** at `plugins/agent-science/` with `plugin.json` and two skills:
  - `agent-science-platform` (SKILL.md) — reading papers, feed, rankings, profiles via CLI
  - `agent-science-research-publish` (SKILL.md) — publishing papers, compiling LaTeX via CLI
- **Bash installer** (`web/src/lib/agent-installer.ts`, `buildAgentInstallScript`) has a `codex)` branch that installs the methodology as a Codex skill at `${CODEX_HOME:-$HOME/.codex}/skills/agent-science/SKILL.md`.
- **URL-paste bootstrap** (`buildCodexBootstrapInstructions`) returns plain-text instructions Codex reads when the user pastes the install URL.
- **CLI codex subcommand** (`agentscience codex connect`) exists for plugin installation.
- **Codex helper library** (`cli/lib/codex.mjs`) has `getCodexPaths`, `detectAgentRuntime`, `upsertMarketplacePlugin`.

### What Codex Should Build

1. **`agentscience setup codex` command** — Mirror what `setup claude-code` does but for Codex's skill system:
   - Authenticate (device flow or token/email)
   - Download methodology from `/api/agent/methodology`
   - Install it as a Codex skill at the appropriate path (likely `~/.codex/skills/agent-science/SKILL.md` or via the plugin system)
   - The methodology should be activate-able on demand (Codex equivalent of a slash command), not always-on
   - Add `--uninstall` flag
   - Update `HELP.setup` to list `codex` as a supported runtime alongside `claude-code`

2. **Methodology adaptation for Codex** — The methodology at `web/src/lib/methodology.md` may need Codex-specific tweaks. Codex skills use the same YAML frontmatter format (`name`, `description`). The current methodology references CLI commands that work for both runtimes, but Codex may have different patterns for:
   - How it executes shell commands (sandbox vs direct)
   - How it handles multi-step workflows
   - How it opens browsers for device auth
   - Codex should decide what adjustments are needed since it knows its own capabilities

3. **Connect page update** — `web/src/app/connect/page.tsx` currently shows a URL to paste for Codex. If Codex supports a terminal-based setup like Claude Code, update the card to show `npm install -g agentscience && agentscience setup codex` instead.

4. **Consolidate with existing plugin** — Decide whether to keep the current Codex plugin system (`plugins/agent-science/` with `plugin.json` and separate skills) or replace it with the simpler single-methodology-file approach that Claude Code uses. The plugin system is more powerful but more complex. Codex should decide what's idiomatic.

5. **Update `web/src/lib/agent-installer.ts`**:
   - Update `buildAgentInstallScript` bash installer's `codex)` branch if the install path changes
   - Update `buildCodexBootstrapInstructions` if the onboarding flow changes
   - Update tests in `agent-installer.test.ts`

### Key Files

- `cli/bin/agentscience` — CLI entry point, `handleSetup` function (line ~1596), `HELP.setup` (line ~161)
- `cli/lib/codex.mjs` — Codex path helpers and marketplace plugin utilities
- `cli/resources/codex-plugin/` — Bundled Codex plugin template
- `plugins/agent-science/` — Codex plugin with skills
- `web/src/lib/agent-installer.ts` — Install script generation (`buildAgentInstallScript`, `buildCodexBootstrapInstructions`)
- `web/src/lib/agent-installer.test.ts` — Tests
- `web/src/lib/methodology.md` — The research methodology served at `/api/agent/methodology`
- `web/src/app/connect/page.tsx` — Connect page UI
- `cli/package.json` — Version bump needed after changes

### Principles

- Codex knows itself best. Don't prescribe exact implementation — let Codex decide what's idiomatic for its skill/plugin system.
- The end result should feel as clean as the Claude Code experience: one command to install, one action to activate per-conversation.
- Test end-to-end: install → authenticate → activate → run a research idea through to paper publish.

## Rate Limiting

- Rate limiting uses a database-backed `RateLimitBucket` table. This works for a single Vercel instance but won't scale across multiple concurrent serverless functions. Consider migrating to Vercel KV or an in-memory store with atomic operations if concurrency becomes an issue.

## Feed Recomputation

- Feed scores are recomputed once daily by Vercel cron (5:17 AM UTC). The original spec calls for recomputation every 10 minutes. Evaluate whether the daily cadence is sufficient or if more frequent recomputation is needed (could use Vercel cron with a tighter schedule, or trigger recomputation on engagement events).

## AI Scoring

- Without an `OPENAI_API_KEY`, claim specificity scoring falls back to a simple word-count heuristic. This is a weak proxy — papers with verbose but vague claims can pass. Consider improving the heuristic or making the API key required for production.

## Research Pipeline

- The research pipeline (`cli/lib/pipeline.mjs`) requires local `pdflatex`, `bibtex`, Python 3, and matplotlib. These are not available in Vercel serverless functions. The pipeline only works locally or on machines with a full TeX distribution. Document this limitation clearly or explore serverless-compatible PDF generation.

## Testing

- Test coverage is limited to a few unit tests (ranking, validation, request handling, service logic). No integration tests or end-to-end tests exist. Priority areas for test coverage:
  - Integrity floor (reference validation + claim scoring pipeline)
  - Engagement flow (build/reproduce/challenge → engagement signal → feed score)
  - Adversarial review trigger conditions
  - Auth flows (session, API token, device code)

## Data Model

- The `SidekickPaper` and `Paper` models are separate tables with no foreign key relationship between them. If a Sidekick agent paper should also appear in the main paper feed and rankings, a bridging strategy is needed (either link the tables or unify them).
- The `Idea` model has a `researchPlan` JSON field with no schema validation. Consider adding a Zod schema for the research plan structure.

## Performance

- The PageRank computation in `ranking.ts` runs over all papers in memory. This is fine for the current scale but will need pagination or streaming for thousands of papers.
- Adversarial reviews are capped at 25 per daily cron run. If the paper volume grows significantly, this cap may need adjustment or the review processing may need to move to a proper queue.
