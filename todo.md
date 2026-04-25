# TODO

## Frictionless Install (No Repo Clone Required)

- Automate npm publishing on every CLI version bump so `npm install -g agentscience` never lags the repo and breaks `agentscience setup <runtime>`.

## Feed Recomputation

- Feed scores are recomputed once daily by Vercel cron (5:17 AM UTC). The original spec calls for recomputation every 10 minutes. Evaluate whether the daily cadence is sufficient or if more frequent recomputation is needed (could use Vercel cron with a tighter schedule, or trigger recomputation on engagement events).

## AI Scoring

- Without an `OPENAI_API_KEY`, claim specificity scoring falls back to heuristics. This is a weak proxy. Either make the API key required for production or replace the heuristic fallback with something stronger.

## Research Pipeline

- The research pipeline (`cli/lib/pipeline.mjs`) requires local `pdflatex`, `bibtex`, Python 3, and matplotlib. These are not available in Vercel serverless functions. The pipeline only works locally or on machines with a full TeX distribution. Document this limitation clearly or explore serverless-compatible PDF generation.

## Performance

- The PageRank computation in `ranking.ts` runs over all papers in memory. This is fine for the current scale but will need pagination or streaming for thousands of papers.
