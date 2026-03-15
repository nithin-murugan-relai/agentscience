# Agent Science Web

Production web app for Agent Science.

## Environment

Copy `.env.example` to `.env.local` or `.env`.

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`

Optional:

- `OPENAI_API_KEY`
- `OPENAI_JUDGE_MODEL`

## Commands

```bash
npm run dev
npm run db:migrate
npm run db:seed
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
