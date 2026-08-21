import {
  applyCoinConfluence,
  analyzeTimeframe,
  type Candle,
  type MarketSymbol,
  type SignalSnapshot,
  SYMBOLS,
  TIMEFRAMES,
  type Timeframe,
} from "./signal-engine";

const BINANCE_KLINES_URL = "https://api.binance.com/api/v3/klines";
const CANDLE_LIMIT = 260;

type FetchLike = typeof fetch;

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

function toNumber(value: string | number, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid Binance ${field} value`);
  return parsed;
}

export function normalizeBinanceKlines(rows: BinanceKline[]): Candle[] {
  return rows.map(row => ({
    openTime: row[0],
    open: toNumber(row[1], "open"),
    high: toNumber(row[2], "high"),
    low: toNumber(row[3], "low"),
    close: toNumber(row[4], "close"),
    volume: toNumber(row[5], "volume"),
    closeTime: row[6],
    quoteVolume: toNumber(row[7], "quoteVolume"),
    trades: row[8],
  }));
}

export async function fetchBinanceCandles(
  symbol: MarketSymbol,
  timeframe: Timeframe,
  fetcher: FetchLike = fetch
): Promise<Candle[]> {
  const query = new URLSearchParams({ symbol, interval: timeframe, limit: String(CANDLE_LIMIT), timeZone: "0" });
  const response = await fetcher(`${BINANCE_KLINES_URL}?${query.toString()}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Binance kline request failed for ${symbol} ${timeframe}: ${response.status}`);
  }
  const data = (await response.json()) as BinanceKline[];
  if (!Array.isArray(data) || !data.length) {
    throw new Error(`Binance returned no kline data for ${symbol} ${timeframe}`);
  }
  return normalizeBinanceKlines(data);
}

export async function fetchAndAnalyzeMarket(
  observedAt = Date.now(),
  fetcher: FetchLike = fetch
): Promise<SignalSnapshot[]> {
  const perSymbol = await Promise.all(
    SYMBOLS.map(async symbol => {
      const signals = await Promise.all(
        TIMEFRAMES.map(async timeframe => {
          const candles = await fetchBinanceCandles(symbol, timeframe, fetcher);
          return analyzeTimeframe(symbol, timeframe, candles, observedAt);
        })
      );
      return applyCoinConfluence(signals);
    })
  );
  return perSymbol.flat();
}
