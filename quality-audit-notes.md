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

## All closed-candle Telegram delivery

Heartbeat và manual persist hiện tạo delivery cho mọi nến mới đã đóng ở 15m/1h/4h/1d khi Telegram rule/token/chat đang bật. Các điều kiện score threshold, đổi label, signalStatus Trade và liquidity validity không còn chặn việc gửi; tin nhắn vẫn hiển thị rõ Trade/No Trade, lý do, cảnh báo thanh khoản, confidence và metadata. Candle đã xử lý vẫn bị bỏ qua, delivery failed vẫn retry theo message đã lưu và candle chỉ được mark sau khi gửi thành công.

Regression mới chứng minh cả tín hiệu No Trade, điểm thấp và liquidity-invalid vẫn được gửi. Verification: scheduled tests 7/7, full regression suite đạt, TypeScript clean và production build successful.

## Telegram send mode setting

Migration 0009 adds `telegram_settings.sendMode` with enum values `all_candles` and `strong_only`, defaulting existing users to `all_candles` without destructive changes. The dashboard Telegram settings form now loads and saves the selected mode per user.

`all_candles` sends every newly closed 15m/1h/4h/1d candle. `strong_only` requires Trade status, valid liquidity and absolute score at least the configured threshold. Both modes retain processed-candle idempotency, delivery retry and mark-after-success semantics; skipped strong-only candles are saved and marked processed to avoid repeat evaluation.

Verification: schema migration applied successfully, TypeScript clean, targeted Telegram/Heartbeat tests passed, full regression suite and production build passed, and desktop dashboard preview remained intact.

## Backtest and visual refresh — 2026-08-16

Nguyên nhân Backtest thiếu số liệu hữu ích là pipeline đánh giá snapshot chỉ dùng một cửa sổ nến hiện tại dùng chung cho từng nhóm. Snapshot cũ có thể bị invalid hoặc expired, trong khi UI không hiển thị P&L mark-to-market. Evaluator hiện trả thêm `horizonReturnPercent` từ nến thật cuối cửa sổ quan sát. Hit rate và expectancy vẫn chỉ tính TP/SL đã giải quyết; P&L horizon được hiển thị riêng, không bị trình bày như tỷ lệ thắng.

Bộ scoring kỹ thuật được điều chỉnh theo hướng đối xứng cho Bearish và bổ sung xác nhận cấu trúc 5 nến gần nhất nhằm giảm nhiễu một nến. Logic vẫn look-ahead safe vì chỉ dùng cửa sổ phân tích đã đóng. Không tạo dữ liệu giả hoặc fabricated outcomes.

Backtest được tinh gọn với các metric resolved/expired/horizon, bảng chi tiết và semantic tokens. Theme switching được bật toàn cục, lưu lựa chọn bằng localStorage; Home, Backtest và News Center có nút Light/Dark. Kiểm thử cuối: TypeScript clean, 18 test files / 71 tests passed, production build passed, mobile preview rendered, browser console không có lỗi/warning tương ứng. Build vẫn còn cảnh báo chunk frontend lớn từ bundle Mermaid/editor hiện hữu, không phải lỗi biên dịch.

## Light mode contrast refresh — 2026-08-16

Light mode now uses a neutral warm-white background, white cards, darker foreground/muted text and more visible borders. Signal cards use pale semantic fills instead of translucent saturated overlays: Bullish uses emerald-50, Bearish rose-50 and Neutral amber-50; dark mode retains the existing translucent palette. Risk badges and trend labels use dark light-mode text with dark-mode overrides, improving readability for Bearish/No Trade and risk indicators.

TypeScript passed and targeted technical/UI tests passed: 4 files / 14 tests. A subsequent full QA attempt was terminated by the sandbox under high memory pressure before completion; the prior full suite/build had passed immediately before this CSS-only refresh. The existing production build warning concerns large frontend chunks, not a TypeScript or runtime error.

## Motion and report export — 2026-08-16

Global interactions now use short hover/active transitions for buttons, links, inputs and selects, while theme changes add a 220ms semantic color transition. The transition is gated by `prefers-reduced-motion: no-preference`. Backtest now exposes PNG export using `html-to-image` for the current real-data report region and PDF export through the browser print flow, with print CSS hiding controls and preserving report content.

Verification: TypeScript passed; 4 targeted test files / 16 tests passed. The production Vite build was attempted twice and was terminated by the sandbox during chunk rendering / heap allocation due to high memory pressure. This is consistent with the existing large Mermaid/editor bundle warning; no TypeScript error was reported. The prior production build before this export-only change passed successfully.

## Neutral Light mode and indicator tooltips — 2026-08-16

Light-mode signal cards no longer use pastel pink/green/amber fills as their base background; they use the semantic card surface with only a colored border, while dark mode retains its colored translucent treatment. Risk score and risk explanation panels now use semantic border/background/foreground tokens instead of dark-only hardcoded colors.

A reusable indicator tooltip was added to the SignalCard metrics. RSI explains momentum and 30/70 interpretation; ADX explains trend strength versus direction; ATR explains volatility and stop-distance context; Volume explains the current-to-average volume ratio. Tooltips are keyboard-focusable, use a constrained mobile width and semantic Light/Dark colors. Verification: TypeScript clean, 4 test files / 11 tests passed, and mobile preview rendered without layout overflow.

## Glossary and performance charts — 2026-08-16

A new protected-by-app route `?page=glossary` provides a searchable, category-filtered reference library covering EMA, MACD, RSI, ADX, ATR, volume ratio, trend/risk/confidence, multi-timeframe confirmation, Entry, TP1/TP2, SL, No Trade and Backtest metrics including hit rate, expectancy, maximum drawdown and horizon P&L. Each entry separates meaning, interpretation and caution.

Signal cards now display EMA 9/21/50 and MACD values alongside RSI, ADX, ATR and volume, with keyboard-focusable tooltips for each. Entry, TP1 and SL also have detailed tooltips explaining their role and limitations. Backtest now includes a second responsive line chart comparing horizon P&L, expectancy and maximum drawdown by group, while keeping the original bar chart and real backend metrics.

Verification: TypeScript clean, 4 test files / 16 tests passed, and mobile screenshots for Glossary and Backtest rendered without visible overflow. The preview continues to show the expected unauthenticated loading state for protected Backtest data.

## Interactive MACD/RSI and white Light mode — 2026-08-16

Each SignalCard now includes compact interactive MACD and RSI charts calculated from the real candle window already delivered by the market analysis endpoint. MACD shows histogram, MACD line and signal line with hover values; RSI shows the current series with 30/70 reference lines and hover values. The charts are responsive and show a clear empty state when the candle window is too short.

Light-mode `background`, `card`, `popover`, secondary, muted and accent tokens were normalized to white/near-white neutral surfaces; Dark mode tokens remain unchanged. Verification: TypeScript clean, 3 test files / 10 tests passed, and the mobile preview rendered without visible overflow.

## Synchronized charts and candle window — 2026-08-16

Price, MACD and RSI charts in each SignalCard now share a stable Recharts `syncId`, so hover/cursor selection is synchronized to the same candle time. The indicator panel includes 30, 60 and 120 candle buttons; the price chart uses the same selected window. MACD/RSI can be opened in an accessible full-screen dialog with a close control and the synchronized cursor retained.

Verification: TypeScript clean, 3 test files / 10 tests passed, dev server restarted cleanly and mobile preview rendered without visible overflow.

## Trading Bot credential input section — 2026-08-16

A dedicated `?page=trading-bot` page now provides separate input sections for Binance API key/secret, OKX API key/secret/passphrase, and a public EVM/BSC wallet address. Secret fields are masked with reveal controls, wallet input explicitly rejects the private-key workflow, and the page displays the intended safety boundaries: Read/Trade only, no withdrawals, per-order confirmation, maximum risk per order and a kill-switch-style enable toggle.

The current form performs local validation messaging only and does not place orders. The server-side secrets request was rejected by the user, so no API credentials were stored and no exchange connection was activated. This is intentional: live execution remains disabled until credentials are supplied through the secure secrets flow and exchange-specific server integration is implemented. Verification: TypeScript clean, 4 test files / 13 tests passed, and mobile preview rendered the Trading Bot form without visible overflow.

## Offline Trading Bot test mode — 2026-08-16

The Trading Bot page now defaults to offline test mode. Binance and OKX API input is skipped and the UI explicitly states that no credentials are read, no exchange connection is tested and no real order is submitted. The Passphrase field was moved from the OKX section into the EVM/BSC DEX wallet section, alongside the public wallet address; private keys remain explicitly disallowed. The live bot switch remains off by default and per-order confirmation remains enabled.

Verification: dev server restarted cleanly, full-page mobile preview rendered without visible overflow, TypeScript clean, and 4 test files / 13 tests passed.

## Paper trading, settings audit and DEX wallet validation — 2026-08-16

Trading Bot now reads the existing `market.all` signal stream and presents real BTC/ETH analyses with the captured Entry, TP1 and SL levels. Users can open paper trades, review Long/Short direction, and re-evaluate whether the current signal price has reached TP or SL. Paper trades are stored locally for the test workspace and never call exchange APIs or submit orders.

The interface records offline-mode changes, live switch changes, confirmation preference, risk-limit changes and paper-trading checks in a bounded local audit history. EVM/BSC wallet input validates `0x` plus 40 hexadecimal characters in real time, with accessible invalid/valid border and message states. Verification: TypeScript clean, 4 test files / 13 tests passed, server restart clean and mobile full-page preview rendered without visible overflow.

## Database-backed paper bot automation — 2026-08-16

Migration 0010 created `paper_trades` and `paper_bot_audit_logs` without destructive changes. Protected tRPC procedures now create/list/refresh paper trades and read/write audit events per user. Refresh uses the current public market analysis stream and closes open paper trades at TP or SL, calculating directional P&L; the Trading Bot refreshes automatically every 30 seconds while offline mode is enabled.

Telegram signal keyboards now include safe URLs to open the Paper Bot and P&L views. These buttons do not execute exchange or DEX orders. The Trading Bot displays database-backed paper history, TP/SL counts, total P&L and an equity curve. Verification: migration applied successfully, TypeScript clean, and 4 test files / 13 tests passed.

## Telegram paper webhook and equity filters — 2026-08-16

Added `POST /api/telegram/webhook` with `X-Telegram-Bot-Api-Secret-Token` validation using the server-side `TELEGRAM_WEBHOOK_SECRET`. Authorized chat IDs are resolved through the user's Telegram settings. Supported paper-only commands are `/paper_open EXCHANGE SYMBOL INTERVAL`, `/paper_close ID`, `/paper_pause`, and `/paper_resume`; no live CEX/DEX execution path is called. Pause state blocks the protected paper refresh procedure for the current server process. A smoke request with the configured secret and an unmapped test chat returned HTTP 200 without sending a Telegram message.

Trading Bot equity/P&L now filters closed trades by BTC/ETH and 15m/1h/4h/1d. The preview was checked on a 390px viewport, TypeScript passed, 5 test files / 14 tests passed, and filtered browser console logs contained no runtime error records. The previous 28-character webhook secret failed the new minimum-length test; it was replaced through the secret manager and the test then passed.
