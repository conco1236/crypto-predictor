export const CONFIDENCE_EXCHANGES = ["Binance", "Bybit", "OKX"] as const;
export const CONFIDENCE_SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const CONFIDENCE_INTERVALS = ["15m", "1h", "4h", "1d"] as const;

export type ConfidenceTimelineFilter = { exchange: (typeof CONFIDENCE_EXCHANGES)[number]; symbol: (typeof CONFIDENCE_SYMBOLS)[number]; interval: (typeof CONFIDENCE_INTERVALS)[number] };
export const DEFAULT_CONFIDENCE_TIMELINE_FILTER: ConfidenceTimelineFilter = { exchange: "Binance", symbol: "BTCUSDT", interval: "1h" };

export function parseConfidenceTimelineFilter(search: string): ConfidenceTimelineFilter {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const exchange = params.get("exchange");
  const symbol = params.get("symbol");
  const interval = params.get("interval");
  return {
    exchange: CONFIDENCE_EXCHANGES.includes(exchange as ConfidenceTimelineFilter["exchange"]) ? exchange as ConfidenceTimelineFilter["exchange"] : DEFAULT_CONFIDENCE_TIMELINE_FILTER.exchange,
    symbol: CONFIDENCE_SYMBOLS.includes(symbol as ConfidenceTimelineFilter["symbol"]) ? symbol as ConfidenceTimelineFilter["symbol"] : DEFAULT_CONFIDENCE_TIMELINE_FILTER.symbol,
    interval: CONFIDENCE_INTERVALS.includes(interval as ConfidenceTimelineFilter["interval"]) ? interval as ConfidenceTimelineFilter["interval"] : DEFAULT_CONFIDENCE_TIMELINE_FILTER.interval,
  };
}

export function parseConfidenceTimelineTarget(search: string) {
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("target");
  const value = raw == null ? NaN : Number(raw);
  return Number.isSafeInteger(value) && value >= 946_684_800_000 && value <= 4_102_444_800_000 ? value : null;
}

export function buildConfidenceTimelinePath(filters: ConfidenceTimelineFilter, targetCandleClosedAt?: number | null) {
  const params = new URLSearchParams({ page: "confidence-timeline", exchange: filters.exchange, symbol: filters.symbol, interval: filters.interval });
  if (targetCandleClosedAt != null && Number.isSafeInteger(targetCandleClosedAt) && targetCandleClosedAt >= 946_684_800_000 && targetCandleClosedAt <= 4_102_444_800_000) params.set("target", String(targetCandleClosedAt));
  return `/?${params.toString()}`;
}

export function buildConfidenceTimelineUrl(filters: ConfidenceTimelineFilter, baseUrl: string, targetCandleClosedAt?: number | null) {
  return `${baseUrl.replace(/\/$/, "")}${buildConfidenceTimelinePath(filters, targetCandleClosedAt)}`;
}
