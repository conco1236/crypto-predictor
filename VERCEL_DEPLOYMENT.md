# Vercel Deployment Readiness

## Current export status

This repository is ready to be synchronized to GitHub as a **source export**. It is **not safe to deploy unchanged to Vercel** because the current application uses platform-managed OAuth, Heartbeat authentication, storage helpers, database wiring, and server bootstrap code. Vercel can host Express as a single Vercel Function when the app is exported correctly, but it does not execute this managed bootstrap unchanged. [Vercel Express documentation](https://vercel.com/docs/frameworks/backend/express)

| Current capability | Vercel-compatible replacement required |
| --- | --- |
| `server/_core/index.ts` starts an HTTP listener and serves Vite itself | Export an Express app or separate the frontend build from a Vercel Function entry. Do not retain the managed listener bootstrap. |
| Manus OAuth and `server/_core/sdk.ts` | Replace with an external authentication provider or a custom signed-session implementation. |
| Heartbeat POST endpoint and six-field cron | Add a Vercel Cron-compatible `GET` endpoint, protect it with a `CRON_SECRET`, and define a five-field UTC schedule in `vercel.json`. Vercel Cron calls the production deployment by HTTP GET. [Vercel Cron documentation](https://vercel.com/docs/cron-jobs) |
| Managed MySQL and storage environment | Provision an external MySQL-compatible database and object storage, then supply their credentials in Vercel Environment Variables. |
| Built-in platform variables and notifications | Replace each integration with an external equivalent or remove it from the exported product. |

## Target configuration after migration

The migrated Vercel project should use a standard Express function entry and independent Vite static build. Server-only secrets belong in Vercel Environment Variables, never in source control. At minimum, use `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and `CRON_SECRET`; add the new authentication provider’s variables separately. Do **not** copy any `BUILT_IN_*`, `JWT_SECRET`, `OAUTH_SERVER_URL`, or owner variables from the current managed environment.

For the market refresh, Vercel Cron uses five cron fields and UTC. A conceptual configuration is shown below only after the application exposes a compatible `GET` endpoint:

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

The Telegram webhook can continue to derive its callback domain from the verified incoming HTTPS host after the exported Express handler is running on Vercel. The bot token and webhook secret must be configured in Vercel, and the webhook must be registered only after the production deployment is live.

## Recommended delivery sequence

First, import the GitHub branch into a new Vercel project as a preview environment, not production. Then complete the migration items in the table above, add the Vercel environment variables, run database migrations against the external database, and validate the webhook and cron endpoint independently. Only after those checks should the Vercel project be promoted to production.

> The current managed hosting path remains the lower-risk way to run this exact code today, because its database, OAuth, Heartbeat, and Telegram workflow are already wired together.
