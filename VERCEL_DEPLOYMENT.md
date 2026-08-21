# Vercel Deployment Readiness

## Current export status

This repository now contains a Vercel-compatible runtime entry. The Vite application is built by `pnpm build:vercel`; the Express API is exported from `api/[...path].ts`; and `server/vercel-app.ts` registers only the public dashboard APIs, Telegram webhook, protected webhook-registration route, and Vercel Cron endpoint. Vercel hosts Express as a Vercel Function when the application is exported correctly. [Vercel Express documentation](https://vercel.com/docs/frameworks/backend/express)

| Requirement | Implemented Vercel boundary |
| --- | --- |
| Managed listener and Vite middleware | Replaced by an exported Express application in `server/vercel-app.ts` and static Vite output in `dist/public`. |
| Manus OAuth | The Vercel dashboard is intentionally public; `server/vercel-context.ts` provides an anonymous tRPC context and no managed OAuth route is registered. |
| Heartbeat POST and six-field cron | Replaced by `GET /api/cron/market-refresh`, guarded by `CRON_SECRET`, and a five-field UTC schedule in `vercel.json`. [Vercel Cron documentation](https://vercel.com/docs/cron-jobs) |
| Telegram webhook registration | `POST /api/admin/register-telegram` is protected by `ADMIN_SETUP_TOKEN` and derives the callback URL from the verified HTTPS request host. |
| MySQL persistence | Retained through `DATABASE_URL`; provision a MySQL-compatible hosted database before deployment. |

## Required Vercel environment variables

Copy `.env.vercel.example` into **Project Settings → Environment Variables**, add real values there, and do not commit them. The deployment uses `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_SETUP_TOKEN`, `DEPLOY_TARGET=vercel`, and `VITE_DEPLOY_TARGET=vercel`.

`CRON_SECRET` must be a random server-only value of at least 16 characters. Vercel includes it as an `Authorization: Bearer ...` header when invoking the Cron route. [Vercel Cron security documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

## Cron configuration

The project already includes the following Vercel Cron schedule. It uses five fields and UTC:

```json
{
  "crons": [
    {
      "path": "/api/cron/market-refresh",
      "schedule": "* * * * *"
    }
  ]
}
```

## Telegram activation after the production deployment

After the Vercel production URL is live, call the protected setup route once from a terminal. Replace the placeholders locally; never place them in source control:

```bash
curl -X POST "https://YOUR-PRODUCTION-DOMAIN/api/admin/register-telegram" \
  -H "Authorization: Bearer YOUR_ADMIN_SETUP_TOKEN"
```

The route registers the webhook using the incoming HTTPS host and then the bot accepts the exact `/btc` and `/eth` commands. The webhook secret remains server-only.

## Recommended delivery sequence

Import the GitHub branch into a new Vercel project. Configure the environment variables, create the external MySQL database, run the Drizzle migrations against that database, and create a preview deployment first. Validate `/api/health`, the public dashboard, and the Cron route with the `CRON_SECRET` before promoting to production. Finally, run the Telegram activation command above.

> The Vercel export intentionally does not replicate managed OAuth. If private dashboard access is required later, add an external identity provider rather than reusing platform-managed OAuth.
