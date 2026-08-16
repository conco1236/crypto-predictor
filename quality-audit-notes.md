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

## Multi-timeframe, No Trade and liquidity upgrade

Each analysis now receives an explicit `Trade` or `No Trade` status. The 15m signal requires 1h and 4h agreement, the 1h signal requires 4h and 1d agreement, the 4h signal requires 1d agreement, and 1d requires a stronger local score. Neutral, weak, conflicting or missing higher-timeframe data is retained as a snapshot but is blocked from Telegram delivery with a human-readable reason.

Before delivery, the market adapter fetches real orderbook data once per exchange/symbol from Binance, Bybit and OKX. It calculates best-bid/ask spread, USD depth within ±0.5%, current candle volume ratio and cross-exchange volume agreement. Alerts are blocked when liquidity validation fails, while the dashboard and Telegram formatter expose the validation status and warnings. Legacy test fixtures without the new metadata retain compatibility defaults, but production analyses always receive explicit metadata.

The new `pnpm backtest` command performs walk-forward evaluation from real exchange candles, uses only candles before each signal for indicators, evaluates future candles for TP/SL, and groups results by exchange, asset and interval. A real run with 120 candles and an 8-candle forward window produced `backtest-results.json`; the output includes total signals, resolved count, hit rate, expectancy and max drawdown. These figures are diagnostic samples, not guarantees and should not be interpreted as investment performance.

Final verification for this upgrade: TypeScript clean, 64/64 Vitest tests passing, 16 targeted tests passing for multi-timeframe/liquidity/scheduled paths, production build successful, dashboard preview rendered, and browser console had no matching key/runtime warning.

## Telegram inline keyboard, Backtest UI and No Trade decision trace

Telegram alerts now include URL-based inline keyboard buttons for a TradingView chart and the dashboard liquidity view. The buttons contain only exchange/symbol/interval query parameters; bot tokens and callback secrets are never placed in message markup. Manual sends and Heartbeat retries both rebuild the same safe keyboard.

A protected `?page=backtest` dashboard page now provides exchange, asset and timeframe filters, summary metrics, a hit-rate/expectancy chart, a detailed breakdown table and a methodology disclaimer. The outcomeMetrics backend was changed to evaluate groups in parallel; the observed request duration fell to approximately 3.65 seconds in the preview log instead of approximately 25.4 seconds before optimization.

SignalCards now show a No Trade decision trace containing the status reason, aligned and conflicting timeframes, technical confidence reasons and liquidity warnings. The aggregate AI summary also receives signal status, reason and liquidity warnings so its Vietnamese explanation does not omit the decision context.

Final verification for this feature set: TypeScript clean, 67/67 Vitest tests passing, production build successful, Backtest preview rendered with filters, and browser console contained no matching React key/runtime warning.

## Automated 1h AI/news Telegram analysis

The 1h candle-close path now fetches recent BTC/ETH context from public RSS feeds (CoinDesk and Crypto Briefing), filters items to the last six hours, preserves source, URL and publication timestamp, and passes only that bounded context to the server-side LLM. The Telegram message includes up to three related headlines with source/time/URL. Other timeframes do not receive a misleading news section.

News fetch failures, stale feeds and empty matches do not block the technical signal: the AI prompt explicitly states that no news is available and must not infer events, while the existing AI fallback still produces a technical-only explanation. New 1h deliveries persist the final message, so retries do not call RSS or AI again. The existing Heartbeat candle-close, processed-candle guard, delivery log and retry/idempotency path remain active.

Final verification: TypeScript clean, 69/69 Vitest tests passing across 18 files, production build successful, and browser console had no matching React key/runtime warning. RSS sources were selected after verifying the published feed documentation from CoinDesk and Crypto Briefing.

## News settings and history upgrade

Migration `0007_pretty_cargill.sql` tạo `news_ai_settings`, `news_items` và `ai_analyses` cùng index tra cứu; đã áp dụng production, không destructive. News Center hỗ trợ cấu hình nhiều RSS URL, lookback 1–48 giờ, các interval AI và bật/tắt news context; custom RSS URL được adapter sử dụng thật. Heartbeat/manual persist đọc cấu hình theo user, lưu news items và AI analysis history; retry vẫn dùng delivery message đã persist. Dashboard có route `?page=news`, history theo coin và AI history 1h; Home có search/filter signal history theo symbol/interval. Verification: TypeScript đạt, 69/69 tests đạt, production build đạt; preview desktop 1280 và mobile 375 không ghi nhận lỗi layout trong vùng đã kiểm tra.

## News pagination, price timeline and reanalysis

- News Center now uses server-side page/size queries for news and AI history, with user/symbol filters and hasMore pagination state; the client no longer loads the full history collection.
- `market.timeline` combines persisted signal snapshot prices and collected news by protected user scope; News Center renders a 1h price line and links important collected headlines to source URLs. No synthetic market data is generated.
- `market.reanalyze` verifies snapshot ownership, enforces a persistent 15-minute per-user/per-snapshot window through `ai_reanalysis_requests`, calls AI only after the guard, stores the new analysis and records completed/failed audit status.
- Verification: TypeScript clean, full regression suite passed, production build passed, and desktop preview showed pagination controls and the timeline section without layout overflow.
