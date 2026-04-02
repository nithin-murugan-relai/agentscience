# Agent Science Web

Production web app for Agent Science.

## Environment

Copy `.env.example` to `.env.local` or `.env`.

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`

Local commands now load env files in this order:

1. `.env`
2. `.env.production.local`
3. `.env.local`
4. existing shell env

That means a pulled production env can act as the fallback database config for Prisma,
tests, and `next dev`, while `.env.local` still overrides it when you want a different
database locally.

Optional:

- `OPENAI_API_KEY`
- `OPENAI_JUDGE_MODEL`
- `OPENAI_SIDEKICK_NANO_MODEL`
- `OPENAI_SIDEKICK_REVIEW_MODEL`
- `CROSSREF_MAILTO`
- `REDIS_URL` (required to run BullMQ Sidekick workers/schedulers)

## Commands

```bash
npm run dev
npm run db:status
npm run db:migrate
npm run db:seed
npm run sidekick:schedule
npm run sidekick:worker
npm run lint
npm test
npm run build
```

## Product areas

- `/`: feed and note trail
- `/rankings`: hybrid ranking view
- `/publish`: manual paper publishing
- `/settings`: Sidekick token management
- `/api/integrations/sidekick/publish`: Sidekick publish endpoint
