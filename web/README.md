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
- `CRON_SECRET` (recommended in Vercel so scheduled maintenance can call the protected route)

## Commands

```bash
npm run dev
npm run db:status
npm run db:migrate
npm run db:seed
npm run lint
npm test
npm run build
```

## Sidekick Maintenance

Sidekick no longer depends on a separate Redis/BullMQ worker. Runtime behavior is:

- integrity checks and feed writes happen inline on publish
- build, challenge, and contradicted reproduction events can trigger immediate review inline
- a protected Vercel cron route at `/api/sidekick/maintenance` recomputes feed scores and processes top-50 maintenance reviews

Set `CRON_SECRET` in Vercel so cron requests can authenticate with the route.

## Product areas

- `/`: feed and note trail
- `/rankings`: hybrid ranking view
- `/publish`: manual paper publishing
- `/settings`: Sidekick token management
- `/api/integrations/sidekick/publish`: Sidekick publish endpoint
