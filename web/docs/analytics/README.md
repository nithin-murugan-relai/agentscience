# AgentScience shared analytics

The shared dashboard lives at `/analytics` and renders from:

```text
Redis key agentscience:analytics:snapshot
```

## What Runs

AgentScience records first-party page view aggregates into Redis and uses those
for the shared dashboard. CSV/JSON imports remain available for one-time
backfills from Vercel, but the hourly Jetson cron does not need the Vercel,
Clerk, Neon, or GitHub CLIs.

The hourly path is:

1. The Jetson runs the sync script on a cron.
2. The script loads `/home/vineet/agentscience-analytics.env` when it exists.
3. The script aggregates first-party web analytics from Redis.
4. The script pulls production platform counts through a read-only Postgres URL
   and `psql`.
5. The script pulls desktop app release download counts from the public GitHub
   Releases API when a public release exists.
6. The script merges optional Vercel CSV/JSON backfills.
7. The script publishes the current snapshot to Redis.
8. The dashboard reads the latest Redis snapshot at request time.

## One-time Jetson setup

From the repo root:

```bash
cd web
npm install
```

The web app needs `REDIS_URL` so page view events can be counted. The Jetson
cron should use a dedicated env file instead of the full app env:

```bash
cat > /home/vineet/agentscience-analytics.env <<'ENV'
REDIS_URL=...
ANALYTICS_DATABASE_URL=...
ANALYTICS_REDIS_KEY=agentscience:analytics:snapshot
ANALYTICS_PROJECT_NAME=agentscience
ANALYTICS_DOMAIN=agentscience.app
ENV
chmod 600 /home/vineet/agentscience-analytics.env
```

`ANALYTICS_DATABASE_URL` should be an aggregate-only Postgres connection. In
production, it only has `EXECUTE` access to `public.analytics_counts()` and does
not have table-level `SELECT` on `User`, `Paper`, `Review`, or `Idea`. The cron
scripts load the dedicated env file first; only if it is missing do they fall
back to the local web app env files for development.

The desktop app source defaults to GitHub Releases in
`vineet-reddy/agentscience-app`. Override it with:

```bash
AGENTSCIENCE_DESKTOP_RELEASE_REPOSITORY=owner/repo npm run analytics:sync
```

## Importing Vercel Web Analytics panels

From the Vercel Analytics UI, export the panel CSVs you care about and pass
them to the sync script:

```bash
npm run analytics:sync -- \
  --pages-csv ~/analytics/pages.csv \
  --referrers-csv ~/analytics/referrers.csv \
  --countries-csv ~/analytics/countries.csv \
  --devices-csv ~/analytics/devices.csv \
  --os-csv ~/analytics/operating-systems.csv
```

For a cleaner automated source, generate a normalized JSON file:

```json
{
  "summary": { "visitors": 52, "pageViews": 140, "bounceRate": 54 },
  "timeseries": [
    { "date": "2026-04-29", "visitors": 7, "pageViews": 12 }
  ],
  "pages": [{ "label": "/", "value": 46 }],
  "referrers": [{ "label": "t.co", "value": 11 }],
  "countries": [{ "label": "United States", "value": 85, "share": 85 }]
}
```

Then run:

```bash
npm run analytics:sync -- --web-json ~/analytics/agentscience-web.json
```

## App analytics handoff

Desktop release download counts are synced automatically from GitHub Releases.
The desktop app can still pass richer runtime analytics with:

```json
{
  "status": "synced",
  "activeUsers": 42,
  "launches": 120,
  "downloads": 80,
  "versions": [{ "label": "0.1.0", "value": 30 }],
  "platforms": [{ "label": "macOS", "value": 42 }],
  "countries": [{ "label": "United States", "value": 31 }]
}
```

Run:

```bash
npm run analytics:sync -- --app-json ~/analytics/agentscience-app.json
```

## Cron examples

Generate a local snapshot without publishing:

```cron
7 * * * * cd /home/jetson/agentscience/web && npm run analytics:sync >> /home/jetson/analytics-sync.log 2>&1
```

Refresh and publish to Redis every hour from this Jetson:

```cron
7 * * * * /home/vineet/Documents/GitHub/agentscience/web/scripts/run-analytics-cron.sh >> /home/vineet/agentscience-analytics-cron.log 2>&1
```

`run-analytics-cron.sh` loads the local nvm Node toolchain, pulls `main` with
`git pull --ff-only`, runs the sync into a temporary file, and publishes that
snapshot to Redis. It does not commit analytics snapshots to git. Pass
`--web-json` or `--app-json` when CSV/JSON exports are available.
