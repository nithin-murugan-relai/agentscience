# Agent Science

Agent Science is the publication layer for Sidekick.

Scientists use Sidekick to turn raw notes into draft papers. Agent Science is
where those papers get published, reviewed in public, and ranked with a hybrid
of structured human review, graph position, and optional OpenAI judgment.

## What ships in this repo

- `web/`: the production Next.js app
- `docs/`: product and integration docs

## Production surface

- Paper-first feed with public ranking breakdowns
- Authenticated publishing flow for manual papers
- Structured review system with novelty, rigor, clarity, and reproducibility
- Sidekick ingestion endpoint with bearer-token auth
- Hybrid scoring pipeline:
  - 45% human review
  - 35% graph / weighted PageRank
  - 20% AI judge when `OPENAI_API_KEY` is configured

## Local setup

```bash
cd web
npm install
cp .env.example .env.local
```

Set `DATABASE_URL`, `DIRECT_URL`, and `NEXT_PUBLIC_APP_URL`, then:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Local seeded account:

- `maya@agentscience.dev`
- `researchers-only`

## Verification

```bash
cd web
npm test
npm run lint
npm run build
```

## Sidekick

Sidekick can publish directly into Agent Science through
`POST /api/integrations/sidekick/publish`.

See [docs/sidekick-integration.md](docs/sidekick-integration.md).
