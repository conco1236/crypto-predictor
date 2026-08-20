import { analyzeCandles, Candle, IndicatorSnapshot, riskAssessment, tradeLevels } from "./indicators";
import type { SignalStatus, TimeframeConfirmation } from "./multiTimeframe";
import { assessSignalQuality, type SignalQualityResult } from "./signalQuality";

export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const INTERVALS = ["15m", "1h", "4h", "1d"] as const;
export const EXCHANGES = ["Binance", "Bybit", "OKX"] as const;
export type SymbolName = (typeof SYMBOLS)[number];
export type IntervalName = (typeof INTERVALS)[number];
export type ExchangeName = (typeof EXCHANGES)[number];

export type MarketDataQuality = {
  candleCount: number;
  closedCandleCount: number;
  sourceLatencyMs: number;
  warnings: string[];
};

export type MarketLiquidityQuality = {
  spreadBps: number;
  depthUsd: number;
  volumeRatio: number;
  crossExchangeAgreement: boolean;
  isValid: boolean;
  warnings: string[];
};

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
  dataQuality: MarketDataQuality;
  liquidity?: MarketLiquidityQuality;
  signalStatus?: SignalStatus;
  signalReason?: string;
  timeframeConfirmation?: TimeframeConfirmation;
  signalQuality?: SignalQualityResult;
};

const BINANCE_BASE = "https://api.binance.com";
const BYBIT_BASE = "https://api.bybit.com";
const OKX_BASE = "https://www.okx.com";

const toBybitInterval: Record<IntervalName, string> = { "15m": "15", "1h": "60", "4h": "240", "1d": "D" };
const toOkxBar: Record<IntervalName, string> = { "15m": "15m", "1h": "1H", "4h": "4H", "1d": "1Dutc" };
const toNumber = (value: unknown) => Number(value ?? 0);

async function json<T>(url: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error(`API market data HTTP ${response.status}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Không thể lấy dữ liệu thị trường");
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

function bookDepthUsd(rows: unknown[][], mid: number) {
  return rows.reduce((sum, row) => { const price = toNumber(row[0]); const quantity = toNumber(row[1]); return Math.abs(price - mid) / Math.max(mid, 1) <= 0.005 ? sum + price * quantity : sum; }, 0);
}

export function assessLiquidity(bids: unknown[][], asks: unknown[][]) {
  const bestBid = toNumber(bids[0]?.[0]);
  const bestAsk = toNumber(asks[0]?.[0]);
  const mid = (bestBid + bestAsk) / 2;
  const spreadBps = mid > 0 ? (bestAsk - bestBid) / mid * 10_000 : Infinity;
  const depthUsd = bookDepthUsd(bids, mid) + bookDepthUsd(asks, mid);
  const warnings: string[] = [];
  if (!Number.isFinite(spreadBps) || spreadBps > 12) warnings.push(`Spread ${Number.isFinite(spreadBps) ? spreadBps.toFixed(1) : "không xác định"} bps vượt ngưỡng`);
  if (depthUsd < 100_000) warnings.push(`Depth 0.5% thấp: $${Math.round(depthUsd).toLocaleString("en-US")}`);
  return { spreadBps: Number.isFinite(spreadBps) ? Number(spreadBps.toFixed(2)) : 999, depthUsd, warnings, isValid: warnings.length === 0 };
}

export async function fetchExchangeLiquidity(exchange: ExchangeName, symbol: SymbolName) {
  const startedAt = Date.now();
  const instId = symbol === "BTCUSDT" ? "BTC-USDT" : "ETH-USDT";
  try {
    let bids: unknown[][] = [];
    let asks: unknown[][] = [];
    if (exchange === "Binance") {
      const data = await json<{ bids?: unknown[][]; asks?: unknown[][] }>(`${BINANCE_BASE}/api/v3/depth?symbol=${symbol}&limit=20`);
      bids = data.bids ?? []; asks = data.asks ?? [];
    } else if (exchange === "Bybit") {
      const data = await json<{ retCode: number; result?: { b?: unknown[][]; a?: unknown[][] } }>(`${BYBIT_BASE}/v5/market/orderbook?category=spot&symbol=${symbol}&limit=50`);
      bids = data.result?.b ?? []; asks = data.result?.a ?? [];
    } else {
      const data = await json<{ code: string; data?: Array<{ bids?: unknown[][]; asks?: unknown[][] }> }>(`${OKX_BASE}/api/v5/market/books?instId=${instId}&sz=50`);
      bids = data.data?.[0]?.bids ?? []; asks = data.data?.[0]?.asks ?? [];
    }
    const assessed = assessLiquidity(bids, asks);
    return { ...assessed, volumeRatio: 0, crossExchangeAgreement: true, sourceLatencyMs: Date.now() - startedAt };
  } catch (error) {
    return { spreadBps: 999, depthUsd: 0, volumeRatio: 0, crossExchangeAgreement: false, isValid: false, warnings: [`Không xác thực orderbook: ${error instanceof Error ? error.message : String(error)}`], sourceLatencyMs: Date.now() - startedAt };
  }
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
  const startedAt = Date.now();
  const [candles, change24h] = await Promise.all([fetchExchangeCandles(exchange, symbol, interval), fetch24hChange(exchange, symbol)]);
  const closedCandles = candles.filter(candle => isCandleClosed(candle.openTime, interval));
  const analysisCandles = closedCandles.length >= 50 ? closedCandles : candles.slice(0, -1);
  const warnings: string[] = [];
  if (closedCandles.length < 50) warnings.push(`Chỉ có ${closedCandles.length} nến đã đóng`);
  if (!Number.isFinite(change24h)) warnings.push("Không xác định được biến động 24h");
  const indicators = analyzeCandles(analysisCandles);
  const closedCandle = analysisCandles.at(-1) ?? candles.at(-1)!;
  const levels = tradeLevels(indicators, analysisCandles);
  return { exchange, symbol, interval, price: candles.at(-1)?.close ?? 0, change24h, candles, indicators, levels, risk: riskAssessment(indicators, analysisCandles, levels), updatedAt: Date.now(), candleOpenTime: closedCandle.openTime, candleClosedAt: closedCandle.openTime + intervalToMs(interval), dataQuality: { candleCount: candles.length, closedCandleCount: closedCandles.length, sourceLatencyMs: Date.now() - startedAt, warnings } };
}

export async function analyzeAllMarkets() {
  const tasks = EXCHANGES.flatMap(exchange => SYMBOLS.flatMap(symbol => INTERVALS.map(interval => analyzeMarket(exchange, symbol, interval).catch(() => null))));
  const results = await Promise.all(tasks);
  const analyses = results.filter((item): item is MarketAnalysis => Boolean(item));
  const liquidityEntries = await Promise.all(EXCHANGES.flatMap(exchange => SYMBOLS.map(async symbol => [exchange, symbol, await fetchExchangeLiquidity(exchange, symbol)] as const)));
  const liquidityByKey = new Map(liquidityEntries.map(([exchange, symbol, liquidity]) => [`${exchange}:${symbol}`, liquidity] as const));
  const enriched = analyses.map(analysis => {
    const liquidity = liquidityByKey.get(`${analysis.exchange}:${analysis.symbol}`) ?? { spreadBps: 999, depthUsd: 0, volumeRatio: analysis.indicators.volumeRatio, crossExchangeAgreement: false, isValid: false, warnings: ["Không có dữ liệu thanh khoản"] };
    const peers = analyses.filter(peer => peer.symbol === analysis.symbol);
    const volumeRatios = peers.map(peer => peer.indicators.volumeRatio).filter(Number.isFinite);
    const median = [...volumeRatios].sort((a, b) => a - b)[Math.floor(volumeRatios.length / 2)] ?? analysis.indicators.volumeRatio;
    const crossExchangeAgreement = volumeRatios.length < 2 || Math.abs(analysis.indicators.volumeRatio - median) <= 0.75;
    const warnings = [...liquidity.warnings];
    if (analysis.indicators.volumeRatio < 0.8) warnings.push("Volume hiện tại thấp hơn 80% trung bình 20 nến");
    if (!crossExchangeAgreement) warnings.push("Volume lệch đáng kể so với các sàn khác");
    return { ...analysis, liquidity: { ...liquidity, volumeRatio: analysis.indicators.volumeRatio, crossExchangeAgreement, isValid: liquidity.isValid && crossExchangeAgreement && analysis.indicators.volumeRatio >= 0.8, warnings } };
  });
  const { applyTimeframeConfirmation } = await import("./multiTimeframe");
  const confirmed = applyTimeframeConfirmation(enriched);
  return confirmed.map(analysis => {
    const peers = confirmed.filter(peer => peer.symbol === analysis.symbol && peer.interval === analysis.interval);
    const prices = peers.map(peer => peer.price).filter(Number.isFinite).sort((a, b) => a - b);
    const medianPrice = prices[Math.floor(prices.length / 2)] ?? analysis.price;
    const priceDeviationBps = medianPrice > 0 ? Math.abs(analysis.price - medianPrice) / medianPrice * 10_000 : 999;
    const directionalAgreement = peers.filter(peer => peer.indicators.label === analysis.indicators.label && peer.indicators.label !== "Neutral").length;
    const conflictingExchanges = peers.filter(peer => peer.indicators.label !== "Neutral" && peer.indicators.label !== analysis.indicators.label).length;
    const quality = assessSignalQuality({
      baseConfidence: analysis.indicators.confidence,
      sourceLatencyMs: analysis.dataQuality.sourceLatencyMs,
      dataWarnings: analysis.dataQuality.warnings,
      liquidityValid: Boolean(analysis.liquidity?.isValid),
      crossExchangeVolumeAgreement: Boolean(analysis.liquidity?.crossExchangeAgreement),
      priceDeviationBps,
      directionalAgreement,
      conflictingExchanges,
    });
    const qualitySummary = quality.penalty ? `Quality gate: -${quality.penalty} confidence · ${quality.reasons.join("; ")}` : `Quality gate: xác nhận liên sàn đạt (${directionalAgreement}/${peers.length} cùng hướng)`;
    const shouldBlockTrade = analysis.signalStatus === "Trade" && !quality.isTradeEligible;
    return {
      ...analysis,
      indicators: { ...analysis.indicators, confidence: quality.confidence, confidenceReasons: [...analysis.indicators.confidenceReasons, qualitySummary] },
      dataQuality: { ...analysis.dataQuality, warnings: quality.penalty ? [...analysis.dataQuality.warnings, qualitySummary] : analysis.dataQuality.warnings },
      signalQuality: quality,
      signalStatus: shouldBlockTrade ? "No Trade" : analysis.signalStatus,
      signalReason: shouldBlockTrade ? `No Trade do quality gate: ${quality.reasons.join(" · ")}` : analysis.signalReason,
    };
  });
}
