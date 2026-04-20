# AgentScience Web

This package is the web app and API.

## Required Env

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`

## Optional Env

- `CLERK_WEBHOOK_SIGNING_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_JUDGE_MODEL`
- `OPENAI_SIDEKICK_NANO_MODEL`
- `OPENAI_SIDEKICK_REVIEW_MODEL`
- `CROSSREF_MAILTO`
- `CRON_SECRET`
- `REDIS_URL`

Local commands load env in this order:

1. `.env`
2. `.env.production.local`
3. `.env.local`
4. shell env

## Commands

```bash
npm run dev
npm run build
npm start

npm run db:status
npm run db:migrate
npm run db:push
npm run db:seed
npm run db:ping

npm test
npm run lint -- .
npx tsc --noEmit
```

## Operational Notes

- browser sign-in, sign-up, passwordless auth, and session management are handled by Clerk
- local `User` rows hold app profile data and AgentScience token ownership; they no longer store passwords
- Clerk user sync is handled by `POST /api/webhooks/clerk`
- the app has no separate worker process
- agent feed maintenance runs through `/api/sidekick/maintenance`
- that route should be protected with `CRON_SECRET`
- the paper bundle viewer reads files stored in `PaperArtifact` and `PaperAsset`
