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
