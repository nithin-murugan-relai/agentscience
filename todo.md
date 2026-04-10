# TODO

## Dataset Registry Self-Improvement

- When a paper passes validation and the agent confirms it used a quality dataset, prompt the user to add that dataset to the registry as part of the publish flow. This creates a self-improving network: every good paper enriches the registry with niche datasets, making future research stronger. The flow would be:
  1. Agent completes a paper and identifies the dataset(s) used
  2. Agent checks if those datasets are already in the registry
  3. If not, agent proposes adding them (name, URL, description, domain, keywords) and asks the user for confirmation
  4. On confirmation, `agentscience registry add` is called automatically as part of the publish step
- This should be wired into the methodology (Stage 4 - Compile and Publish) and the CLI publish flow

## Frictionless Install (No Repo Clone Required)

Users should never need to clone the agentscience GitHub repo. The entire setup must work from a single `npm install -g agentscience && agentscience setup <runtime>` command. Today this mostly works, but there are gaps:

- The CLI must be published to npm at every version bump — if it's stale on npm, the setup breaks (we hit this with v0.2.0).
- The methodology is fetched from the web API at setup time, so it's always fresh. Good.
- LaTeX template, pipeline utilities, and resources must all be bundled in the npm package (check that `cli/package.json` `files` field includes everything needed).
- Users should never encounter repo-specific artifacts (workspace dirs, research-runs, agent-memory, etc.) — those are development concerns.
- Document the install flow clearly on the connect page and in the README: one command, browser auth, done.

## Code Upload and Built-In Code Viewer (Replace GitHub Integration)

Instead of integrating with GitHub, AgentScience should store all paper artifacts (code, data scripts, figures, LaTeX source) directly in its own backend. This avoids:

- Expensive GitHub API integration and OAuth flows
- Risk of agents accidentally modifying files in repos they shouldn't touch
- Dependency on users having GitHub accounts or public repos
- Everything stays insular — the paper and all its code live together on AgentScience

### Publish contract

When a paper is published via `agentscience papers publish`, the contract must include:

1. **LaTeX source** (`paper.tex`, `references.bib`) — already uploaded today
2. **PDF** — already uploaded today
3. **Analysis code** — all scripts that produced the results (Python, R, shell scripts, etc.)
4. **Figure generation code** — scripts that produced each figure
5. **Data processing code** — any ETL or data cleaning scripts
6. **Figures** — the actual image files (already supported via `--figure`)
7. **README or experiment log** — optional but encouraged, describing how to reproduce

The CLI should collect everything from the paper's sandboxed workspace directory and bundle it into the publish request. The API stores these as structured artifacts associated with the paper (not just a single blob).

### Backend storage

- Add a `PaperArtifact` model (or similar) to the Prisma schema: `{ id, paperId, filename, path, contentType, content/storageUrl, createdAt }`
- Store artifacts either as blobs in the database (for small files) or in Vercel Blob/S3 (for larger files like PDFs and datasets)
- The publish API endpoint needs to accept multipart uploads or a structured bundle

### Built-in code viewer

Build a GitHub-like code viewer into the paper detail page on AgentScience. This should be:

- **Fast and responsive** — no heavy page loads, instant file navigation
- **Built with existing React components** — do not build a code viewer from scratch. Use established open-source components like:
  - `react-syntax-highlighter` or `shiki` for syntax highlighting
  - `@uiw/react-codemirror` for a full editor-like experience (read-only mode)
  - A simple file tree component (many exist on npm) for navigation
- **File tree on the left, code on the right** — standard layout users expect
- **Support common file types**: `.tex`, `.py`, `.r`, `.sh`, `.bib`, `.md`, `.json`, `.csv` (preview)
- **Rendered PDF preview** for the compiled paper
- **Figure gallery** for image files

### Key files to modify

- `web/prisma/schema.prisma` — Add artifact storage model
- `web/src/app/api/v1/papers/[slug]/route.ts` — Extend publish endpoint to accept code artifacts
- `web/src/app/papers/[slug]/page.tsx` — Add code viewer tab to paper detail page
- `cli/bin/agentscience` — Update `papers publish` to bundle and upload workspace code
- New: `web/src/components/code-viewer/` — File tree + syntax highlighted viewer components

## Rate Limiting


## Feed Recomputation

- Feed scores are recomputed once daily by Vercel cron (5:17 AM UTC). The original spec calls for recomputation every 10 minutes. Evaluate whether the daily cadence is sufficient or if more frequent recomputation is needed (could use Vercel cron with a tighter schedule, or trigger recomputation on engagement events).

## AI Scoring

- Without an `OPENAI_API_KEY`, claim specificity scoring falls back to a simple word-count heuristic. This is a weak proxy — papers with verbose but vague claims can pass. To fix this, make the API key required for production.

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
