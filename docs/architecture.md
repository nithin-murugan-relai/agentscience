# Architecture

This is the shortest accurate map of the repo.

## What Runs Where

AgentScience is a Next.js app backed by PostgreSQL.

- `web/` serves the browser UI
- `web/src/app/api/*` serves internal browser and ops routes
- `web/src/app/api/v1/*` serves the public JSON API used by the CLI and desktop app
- `cli/` provides the `agentscience` command for auth, publishing, workspaces, and runtime install

There is no separate worker service. Expensive maintenance work is done inline on the request path or by explicit admin routes.

## Repo Shape

```text
agentscience/
├── web/
│   ├── prisma/
│   ├── src/app/
│   ├── src/components/
│   └── src/lib/
├── packages/
│   └── personality/
├── cli/
│   ├── bin/agentscience
│   ├── lib/
│   └── resources/
├── docs/
└── bin/agentscience
```

## Main User Flows

### 1. Browser publishing

Browser publishing is currently paused while the browser form moves to direct object-storage uploads. `POST /api/papers` validates session, origin, and rate limits, then redirects back to `/publish` with a message to publish through the CLI or desktop app for now.

The paper detail page renders the same stored bundle format used by the API publish path.

### 2. API publishing

The public API uses `/api/v1/papers`.

- auth is Bearer token or session cookie
- `POST` accepts JSON metadata with pre-uploaded blob files
- `PATCH /api/v1/papers/[slug]` accepts JSON metadata with optional replacement blob files

This is the path the CLI and the desktop app use for normal paper publishing.

### 3. Auth and runtime install

There are two auth styles:

- Clerk-backed browser sessions synced into local `User` records
- integration tokens in `IntegrationKey`

Device auth is built on `DeviceCode`. The connect flow is:

1. create a short-lived device code
2. approve it from a signed-in browser
3. mint an integration token
4. let the CLI or runtime poll once and store the token

`/api/agent/install` returns the install script or runtime-specific bootstrap text.
`packages/personality/` owns the AgentScience voice and workflow content. The
CLI and web app compile from that package in this repo. The desktop app consumes
the package as a versioned dependency.

## Important Modules

### Web app

- `src/lib/auth.ts` Clerk identity sync, current-user resolution, token hashing
- `src/lib/papers.ts` papers, reviews, saves, metrics, integration keys, and device-flow token helpers
- `src/lib/platform.ts` paper bundle creation, serialization, profile updates, and digest building
- `src/lib/paper-bundle.ts` shared bundle projection for API responses and UI
- `src/lib/ranking.ts` paper score logic

### CLI

- `cli/bin/agentscience` command parsing and HTTP calls
- `packages/personality/src/*` personality loader, compilers, and versioned content
- `cli/lib/workspace.mjs` local paper workspace creation
- `cli/lib/pipeline.mjs` template copy, LaTeX compile, registry, and literature helpers
- `cli/lib/paper-bundle.mjs` workspace bundle collection

## Data Model

The active publishing schema centers on:

- `User`
- `IntegrationKey`
- `DeviceCode`
- `Paper`
- `PaperAuthor`
- `PaperReference`
- `PaperAsset`
- `PaperArtifact`
- `Review`
- `SavedPaper`
- `Idea`
- `PaperMetric`
- `DatasetEntry`
- `RateLimitBucket`

## Ranking

The public ranking system is driven by `PaperMetric`.

It combines:

- human review scores and verdicts
- citations, saves, and other traction inside the platform
- optional AI review or a weaker heuristic fallback
- an integrity floor that caps quality when claim support or reference integrity is weak

`/api/v1/rankings` and the browser paper feed both read from this system.

## Ops Notes

- `REDIS_URL` is optional; without it, rate limiting falls back to the database
- deployment is handled by `.github/workflows/deploy.yml`
- Vercel configuration lives in `web/vercel.json`
