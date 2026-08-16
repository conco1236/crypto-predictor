import { analyzeCandles, Candle, IndicatorSnapshot, riskAssessment, tradeLevels } from "./indicators";

export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
export const EXCHANGES = ["Binance", "Bybit", "OKX"] as const;
export type SymbolName = (typeof SYMBOLS)[number];
export type IntervalName = (typeof INTERVALS)[number];
export type ExchangeName = (typeof EXCHANGES)[number];

export type MarketAnalysis = {
  exchange: ExchangeName;
  symbol: SymbolName;
  interval: IntervalName;
  price: number;
  change24h: number;
  candles: Candle[];
  indicators: IndicatorSnapshot;
  levels: ReturnType<typeof tradeLevels>;
  risk: ReturnType<typeof riskAssessment>;
  updatedAt: number;
  candleOpenTime: number;
  candleClosedAt: number;
};

const BINANCE_BASE = "https://api.binance.com";
const BYBIT_BASE = "https://api.bybit.com";
const OKX_BASE = "https://www.okx.com";

const toBybitInterval: Record<IntervalName, string> = { "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
const toOkxBar: Record<IntervalName, string> = { "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc" };
const toNumber = (value: unknown) => Number(value ?? 0);

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`API market data HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchBinanceCandles(symbol: SymbolName, interval: IntervalName, limit: number) {
  const rows = await json<unknown[][]>(`${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  return rows.map(row => ({ openTime: toNumber(row[0]), open: toNumber(row[1]), high: toNumber(row[2]), low: toNumber(row[3]), close: toNumber(row[4]), volume: toNumber(row[5]) }));
}

async function fetchBybitCandles(symbol: SymbolName, interval: IntervalName, limit: number) {
  const response = await json<{ retCode: number; result?: { list?: string[][] } }>(`${BYBIT_BASE}/v5/market/kline?category=spot&symbol=${symbol}&interval=${toBybitInterval[interval]}&limit=${limit}`);
  if (response.retCode !== 0 || !response.result?.list) throw new Error("Bybit không trả về dữ liệu nến");
  return response.result.list.slice().reverse().map(row => ({ openTime: toNumber(row[0]), open: toNumber(row[1]), high: toNumber(row[2]), low: toNumber(row[3]), close: toNumber(row[4]), volume: toNumber(row[5]) }));
}

async function fetchOkxCandles(symbol: SymbolName, interval: IntervalName, limit: number) {
  const instId = symbol === "BTCUSDT" ? "BTC-USDT" : "ETH-USDT";
  const response = await json<{ code: string; data?: string[][] }>(`${OKX_BASE}/api/v5/market/candles?instId=${instId}&bar=${toOkxBar[interval]}&limit=${limit}`);
  if (response.code !== "0" || !response.data) throw new Error("OKX không trả về dữ liệu nến");
  return response.data.slice().reverse().map(row => ({ openTime: toNumber(row[0]), open: toNumber(row[1]), high: toNumber(row[2]), low: toNumber(row[3]), close: toNumber(row[4]), volume: toNumber(row[5]) }));
}

export async function fetchExchangeCandles(exchange: ExchangeName, symbol: SymbolName, interval: IntervalName, limit = 120): Promise<Candle[]> {
  const safeLimit = Math.max(50, Math.min(limit, 300));
  const candles = exchange === "Binance" ? await fetchBinanceCandles(symbol, interval, safeLimit) : exchange === "Bybit" ? await fetchBybitCandles(symbol, interval, safeLimit) : await fetchOkxCandles(symbol, interval, safeLimit);
  if (candles.length < 50) throw new Error(`${exchange} không trả đủ 50 nến cho ${symbol} ${interval}`);
  return candles;
}

export async function fetch24hChange(exchange: ExchangeName, symbol: SymbolName) {
  try {
    if (exchange === "Binance") {
      const data = await json<{ priceChangePercent?: string }>(`${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${symbol}`);
      return toNumber(data.priceChangePercent);
    }
    if (exchange === "Bybit") {
      const data = await json<{ result?: { list?: Array<{ price24hPcnt?: string }> } }>(`${BYBIT_BASE}/v5/market/tickers?category=spot&symbol=${symbol}`);
      return toNumber(data.result?.list?.[0]?.price24hPcnt) * 100;
    }
    const instId = symbol === "BTCUSDT" ? "BTC-USDT" : "ETH-USDT";
    const data = await json<{ data?: Array<{ open24h?: string; last?: string }> }>(`${OKX_BASE}/api/v5/market/ticker?instId=${instId}`);
    const item = data.data?.[0];
    return item ? (toNumber(item.last) / toNumber(item.open24h) - 1) * 100 : 0;
  } catch { return 0; }
}

export function intervalToMs(interval: IntervalName) {
  return ({ "15m": 15, "1h": 60, "4h": 240, "1d": 1440 }[interval]) * 60_000;
}

export function isCandleClosed(openTime: number, interval: IntervalName, now = Date.now()) {
  return openTime + intervalToMs(interval) <= now;
}

export async function analyzeMarket(exchange: ExchangeName, symbol: SymbolName, interval: IntervalName): Promise<MarketAnalysis> {
  const [candles, change24h] = await Promise.all([fetchExchangeCandles(exchange, symbol, interval), fetch24hChange(exchange, symbol)]);
  const closedCandles = candles.filter(candle => isCandleClosed(candle.openTime, interval));
  const analysisCandles = closedCandles.length >= 50 ? closedCandles : candles.slice(0, -1);
  const indicators = analyzeCandles(analysisCandles);
  const closedCandle = analysisCandles.at(-1) ?? candles.at(-1)!;
  const levels = tradeLevels(indicators, analysisCandles);
  return { exchange, symbol, interval, price: candles.at(-1)?.close ?? 0, change24h, candles, indicators, levels, risk: riskAssessment(indicators, analysisCandles, levels), updatedAt: Date.now(), candleOpenTime: closedCandle.openTime, candleClosedAt: closedCandle.openTime + intervalToMs(interval) };
}

export async function analyzeAllMarkets() {
  const tasks = EXCHANGES.flatMap(exchange => SYMBOLS.flatMap(symbol => INTERVALS.map(interval => analyzeMarket(exchange, symbol, interval).catch(() => null))));
  const results = await Promise.all(tasks);
  return results.filter((item): item is MarketAnalysis => Boolean(item));
}
