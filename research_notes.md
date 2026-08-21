# Integration Research Notes

| Source | Verified implementation constraint |
| --- | --- |
| Binance Spot REST Market API | `GET /api/v3/klines` supports `1m`, `15m`, `1h`, `4h`, and `1d`; each kline includes UTC open time, OHLCV values, close time, trade count, and taker-buy volume. Klines are identified by their open time. |
| Binance Spot REST Market API | A request uses `symbol`, `interval`, and an optional `limit`; the implementation will use public spot pairs `BTCUSDT` and `ETHUSDT` and discard the currently forming candle from close-based calculations. |
| Telegram Bot API | `setWebhook` delivers JSON updates with HTTPS POST and supports a `secret_token`, which Telegram returns in the `X-Telegram-Bot-Api-Secret-Token` header. Failed non-2xx webhook deliveries can be retried, so handlers must be idempotent. |
| Telegram Bot API | Webhook mode and `getUpdates` are mutually exclusive. The bot implementation will use webhook mode, accept `message` updates only, and safely parse the exact `/btc` and `/eth` commands. |

## Source URLs

1. https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/market
2. https://core.telegram.org/bots/api
3. https://core.telegram.org/bots/webhooks

## Vercel Export Constraints

| Vercel capability | Consequence for this project |
| --- | --- |
| Express runs as a Vercel Function and should export the application or use an approved listener structure. Static assets belong in `public/**`; an existing `express.static()` flow is ignored in the serverless runtime. | The current managed server bootstrap must be refactored into a Vercel-compatible app entry before production deployment. |
| Vercel Cron issues HTTP `GET` requests to the production deployment and uses five-field, UTC cron expressions. | The current POST-only `/api/scheduled/market-refresh` Heartbeat handler and six-field expression must be replaced or wrapped by a Vercel cron GET endpoint with separate Vercel authentication. |
| Vercel deployments create an HTTPS deployment URL and expose system URL variables. | Telegram webhook registration can use the production host or Vercel system URL in the exported implementation, but it must not rely on Manus-specific cron identities. |

Sources: https://vercel.com/docs/frameworks/backend/express and https://vercel.com/docs/cron-jobs
