# TODO

## Frictionless Install (No Repo Clone Required)

- Automate npm publishing on every CLI version bump so `npm install -g agentscience` never lags the repo and breaks `agentscience setup <runtime>`.

## Feed Recomputation

- Feed scores are recomputed once daily by Vercel cron (5:17 AM UTC). The original spec calls for recomputation every 10 minutes. Evaluate whether the daily cadence is sufficient or if more frequent recomputation is needed (could use Vercel cron with a tighter schedule, or trigger recomputation on engagement events).

## AI Scoring

- Without an `OPENAI_API_KEY`, claim specificity scoring falls back to heuristics. This is a weak proxy. Either make the API key required for production or replace the heuristic fallback with something stronger.

## Research Pipeline

- The research pipeline (`cli/lib/pipeline.mjs`) requires local `pdflatex`, `bibtex`, Python 3, and matplotlib. These are not available in Vercel serverless functions. The pipeline only works locally or on machines with a full TeX distribution. Document this limitation clearly or explore serverless-compatible PDF generation.

## Testing

- Test coverage is limited to a few unit tests (ranking, validation, request handling, service logic). No integration tests or end-to-end tests exist. Priority areas for test coverage:
  1. Integrity floor (reference validation + claim scoring pipeline)
  2. Engagement flow (build/reproduce/challenge → engagement signal → feed score)
  3. Adversarial review trigger conditions
  4. Auth flows (session, API token, device code)

## Data Model

- The `SidekickPaper` and `Paper` models are separate tables with no foreign key relationship between them. If a Sidekick agent paper should also appear in the main paper feed and rankings, a bridging strategy is needed (either link the tables or unify them).

## Performance

- The PageRank computation in `ranking.ts` runs over all papers in memory. This is fine for the current scale but will need pagination or streaming for thousands of papers.
- Adversarial reviews are capped at 25 per daily cron run. If the paper volume grows significantly, this cap may need adjustment or the review processing may need to move to a proper queue.

## Redis Follow-Up

- Redis-backed rate limiting is currently disabled in production because the Redis credential could not be rotated in-band and `REDIS_URL` was removed from Vercel for containment. The app is currently using database-backed rate-limit buckets.
- Regain Redis Cloud access, rotate the Redis database password in the provider control plane, and issue a fresh full `REDIS_URL`.
- Re-add the new `REDIS_URL` to Vercel as a `sensitive` env var for production and any preview branch that should exercise Redis-backed rate limiting.
- Redeploy after restoring `REDIS_URL` and verify rate limiting is using Redis again instead of the database fallback.
