# Quality upgrade audit notes

- Core indicator tests and market adapter tests pass after the RSI flat-market fix and confidence estimate addition.
- Market adapter now uses an 8-second request timeout with up to three attempts and exposes candle count, closed-candle count, source latency, and warnings through `dataQuality`.
- Telegram alerts include confidence estimate and data-quality metadata with legacy fallbacks.
- Signal cards show confidence and source/candle quality metadata when authenticated.
- Production build completed successfully with `NODE_OPTIONS=--max-old-space-size=1200 pnpm run build`.
- Responsive preview at 390x844 and 1280x720 shows the dashboard header, exchange cards, alert-rule panel, and operations panel without visible overflow. Authenticated SignalCards were not visible in preview because the preview session was not logged in.
- Remaining professional-signal gap: no persisted signal outcome tracking or historical backtest/calibration metrics yet; current confidence is an explainable heuristic, not a validated probability.
- Existing preview log contains an old JSX parse error from an earlier HMR state, but current TypeScript and Vitest runs are clean and the current preview renders successfully.

- Direct WebSocket audit completed: Binance/Bybit/OKX each has provider subscription, 20-second heartbeat, 35-second stale-feed watchdog, exponential reconnect with jitter, and 5-second batched UI emits. The manager ignores malformed frames safely and tracks `eventTime` plus `receivedAt`.
- Remaining WebSocket quality gap: no explicit per-ticker freshness age/latency metric is surfaced in the UI, and no persistent feed-health history is stored. Current connected status therefore indicates socket state, not necessarily price freshness for every symbol.

## Final quality upgrade

The outcome layer now persists one idempotent row per signal snapshot in `signal_outcomes`, including TP/SL/expired/invalid status, exit candle, exit price, return percentage, and evaluation reason. Outcome evaluation rejects snapshots older than the fetched candle window, preventing an apparent historical result from being inferred from incomplete recent data. Simultaneous TP/SL touches use a conservative stop-first assumption.

The dashboard now reports hit rate, resolved/expired counts, expectancy, cumulative return, maximum drawdown, and a breakdown by exchange, asset, and timeframe. Confidence calibration uses a sample-size shrinkage rule and is applied to Telegram alert confidence using previously persisted outcomes. It is deliberately not treated as a probability when the resolved sample is small.

Live freshness is displayed per BTC and ETH ticker for each exchange, with a `Feed stale` state if either ticker exceeds the 35-second watchdog threshold. Database migration `0006_loud_norman_osborn.sql` was applied successfully. Final verification: TypeScript clean, 60/60 Vitest tests passing, and production build successful with the documented large-chunk warning from the existing Mermaid/editor bundle.

## Telegram candle-close and AI alert upgrade

Heartbeat and manual persist paths now generate alerts only for the latest closed candle, retain the existing processed-candle idempotency and delivery retry behavior, and include exchange, timeframe, direction, score, confidence, current price, Entry, TP1, TP2, SL, indicators, candle-close time, data quality and source latency. The four supported intervals remain 15m, 1h, 4h and 1d.

New alerts request a short Vietnamese AI interpretation from the server-side LLM using only the supplied technical context. If the model is unavailable or returns no content, the alert still sends with an explicit fallback message. AI text is HTML-escaped before Telegram delivery, and retries reuse the persisted delivery message rather than invoking AI again. Final verification after this change: TypeScript clean, 61/61 Vitest tests passing, scheduled Telegram tests passing, and production build successful.

## React key warning fix

The runtime warning was traced to the custom `dot` renderer passed to Recharts `Line` in `RiskHistorySparkline`. Each returned SVG circle now has a stable key derived from its data index, including the empty fallback circle. Targeted sparkline tests passed 10/10, the complete suite passed 61/61, TypeScript and production build passed, the dashboard preview rendered successfully, and the browser console contained no matching unique-key warning after HMR.
