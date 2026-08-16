import { analyzeCandles, Candle, IndicatorSnapshot, tradeLevels } from "./indicators";

const BINANCE_BASE = "https://api.binance.com/api/v3/klines";
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
export type SymbolName = (typeof SYMBOLS)[number];
export type IntervalName = (typeof INTERVALS)[number];

export type MarketAnalysis = {
  symbol: SymbolName;
  interval: IntervalName;
  price: number;
  change24h: number;
  candles: Candle[];
  indicators: IndicatorSnapshot;
  levels: ReturnType<typeof tradeLevels>;
  updatedAt: number;
};

function parseKline(row: unknown[]): Candle {
  return { openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]), close: Number(row[4]), volume: Number(row[5]) };
}

export async function fetchCandles(symbol: SymbolName, interval: IntervalName, limit = 120): Promise<Candle[]> {
  const url = `${BINANCE_BASE}?symbol=${symbol}&interval=${interval}&limit=${Math.max(50, Math.min(limit, 1000))}`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Binance trả về HTTP ${response.status}`);
  const data = await response.json() as unknown[][];
  if (!Array.isArray(data) || data.length < 50) throw new Error(`Không đủ dữ liệu nến cho ${symbol} ${interval}`);
  return data.map(parseKline);
}

export async function fetch24hChange(symbol: SymbolName) {
  const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { headers: { accept: "application/json" } });
  if (!response.ok) return 0;
  const data = await response.json() as { priceChangePercent?: string };
  return Number(data.priceChangePercent ?? 0);
}

export async function analyzeMarket(symbol: SymbolName, interval: IntervalName): Promise<MarketAnalysis> {
  const [candles, change24h] = await Promise.all([fetchCandles(symbol, interval), fetch24hChange(symbol)]);
  const indicators = analyzeCandles(candles);
  return { symbol, interval, price: candles.at(-1)?.close ?? 0, change24h, candles, indicators, levels: tradeLevels(indicators, candles), updatedAt: Date.now() };
}

export async function analyzeAllMarkets() {
  const entries = await Promise.all(SYMBOLS.flatMap(symbol => INTERVALS.map(interval => analyzeMarket(symbol, interval))));
  return entries;
}
