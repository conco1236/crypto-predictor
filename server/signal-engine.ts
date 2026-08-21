export const TIMEFRAMES = ["1m", "15m", "1h", "4h", "1d"] as const;
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const SIGNAL_STATUSES = ["Bullish", "Bearish", "Neutral", "No Trade"] as const;
export const RISK_SCORES = ["Low", "Medium", "High"] as const;

export type Timeframe = (typeof TIMEFRAMES)[number];
export type MarketSymbol = (typeof SYMBOLS)[number];
export type SignalStatus = (typeof SIGNAL_STATUSES)[number];
export type RiskScore = (typeof RISK_SCORES)[number];
export type TradeDirection = "Long" | "Short" | null;

export const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const TIMEFRAME_WEIGHTS: Record<Timeframe, number> = {
  "1m": 10,
  "15m": 15,
  "1h": 25,
  "4h": 25,
  "1d": 25,
};

export type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  trades: number;
};

export type TechnicalIndicators = {
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  adx14: number | null;
  atr14: number | null;
  volumeRatio: number | null;
  support: number | null;
  resistance: number | null;
};

export type TradePlan = {
  direction: TradeDirection;
  entryLow: number | null;
  entryHigh: number | null;
  takeProfit: number | null;
  stopLoss: number | null;
};

export type Freshness = {
  stale: boolean;
  lastClosedCandleCloseTime: number;
  expectedNextCandleCloseTime: number;
  observedAt: number;
  lagMs: number;
};

export type SignalSnapshot = {
  symbol: MarketSymbol;
  timeframe: Timeframe;
  candleOpenTime: number;
  candleCloseTime: number;
  currentPrice: number;
  status: SignalStatus;
  riskScore: RiskScore;
  confluenceScore: number;
  indicators: TechnicalIndicators;
  plan: TradePlan;
  freshness: Freshness;
  reasons: string[];
};

const round = (value: number | null, digits = 4): number | null => {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
};

const mean = (values: number[]): number =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const standardDeviation = (values: number[]): number => {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)));
};

function emaSeries(values: number[], period: number): number[] {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * multiplier + result[index - 1] * (1 - multiplier));
  }
  return result;
}

function latestEma(values: number[], period: number): number | null {
  return values.length >= period ? emaSeries(values, period).at(-1) ?? null : null;
}

function calculateRsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;
  let gain = 0;
  let loss = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gain += Math.max(change, 0);
    loss += Math.max(-change, 0);
  }
  let averageGain = gain / period;
  let averageLoss = loss / period;
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
  }
  if (averageLoss === 0) return 100;
  const relativeStrength = averageGain / averageLoss;
  return 100 - 100 / (1 + relativeStrength);
}

function calculateMacd(values: number[]): Pick<TechnicalIndicators, "macd" | "macdSignal" | "macdHistogram"> {
  if (values.length < 35) return { macd: null, macdSignal: null, macdHistogram: null };
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);
  const line = values.map((_, index) => fast[index] - slow[index]);
  const signal = emaSeries(line, 9);
  const macd = line.at(-1) ?? null;
  const macdSignal = signal.at(-1) ?? null;
  return {
    macd: round(macd),
    macdSignal: round(macdSignal),
    macdHistogram: macd !== null && macdSignal !== null ? round(macd - macdSignal) : null,
  };
}

function calculateAtr(candles: Candle[], period = 14): number | null {
  if (candles.length <= period) return null;
  const ranges: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const priorClose = candles[index - 1].close;
    ranges.push(Math.max(candle.high - candle.low, Math.abs(candle.high - priorClose), Math.abs(candle.low - priorClose)));
  }
  let atr = mean(ranges.slice(0, period));
  for (let index = period; index < ranges.length; index += 1) {
    atr = (atr * (period - 1) + ranges[index]) / period;
  }
  return atr;
}

function calculateAdx(candles: Candle[], period = 14): number | null {
  if (candles.length < period * 2 + 1) return null;
  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    tr.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  let smoothTr = tr.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothPlus = plusDm.slice(0, period).reduce((sum, value) => sum + value, 0);
  let smoothMinus = minusDm.slice(0, period).reduce((sum, value) => sum + value, 0);
  const dx: number[] = [];
  const pushDx = () => {
    if (smoothTr <= 0) return;
    const plusDi = (100 * smoothPlus) / smoothTr;
    const minusDi = (100 * smoothMinus) / smoothTr;
    const denominator = plusDi + minusDi;
    if (denominator > 0) dx.push((100 * Math.abs(plusDi - minusDi)) / denominator);
  };
  pushDx();
  for (let index = period; index < tr.length; index += 1) {
    smoothTr = smoothTr - smoothTr / period + tr[index];
    smoothPlus = smoothPlus - smoothPlus / period + plusDm[index];
    smoothMinus = smoothMinus - smoothMinus / period + minusDm[index];
    pushDx();
  }
  if (dx.length < period) return null;
  let adx = mean(dx.slice(0, period));
  for (let index = period; index < dx.length; index += 1) {
    adx = (adx * (period - 1) + dx[index]) / period;
  }
  return adx;
}

export function evaluateFreshness(candle: Candle, timeframe: Timeframe, observedAt: number): Freshness {
  const expectedNextCandleCloseTime = candle.closeTime + TIMEFRAME_MS[timeframe];
  const lagMs = Math.max(0, observedAt - expectedNextCandleCloseTime);
  return {
    stale: observedAt > expectedNextCandleCloseTime + 10_000,
    lastClosedCandleCloseTime: candle.closeTime,
    expectedNextCandleCloseTime,
    observedAt,
    lagMs,
  };
}

export function calculateIndicators(candles: Candle[]): TechnicalIndicators {
  const closes = candles.map(candle => candle.close);
  const latest = candles.at(-1);
  const trailing20 = closes.slice(-20);
  const trailingVolume = candles.slice(-20).map(candle => candle.volume);
  const volumeBaseline = mean(trailingVolume.slice(0, -1));
  const middle = trailing20.length === 20 ? mean(trailing20) : null;
  const deviation = trailing20.length === 20 ? standardDeviation(trailing20) : null;
  const macd = calculateMacd(closes);
  const supportWindow = candles.slice(-20);
  return {
    ema9: round(latestEma(closes, 9)),
    ema21: round(latestEma(closes, 21)),
    ema50: round(latestEma(closes, 50)),
    ema200: round(latestEma(closes, 200)),
    rsi14: round(calculateRsi(closes, 14)),
    ...macd,
    bollingerUpper: middle !== null && deviation !== null ? round(middle + 2 * deviation) : null,
    bollingerMiddle: round(middle),
    bollingerLower: middle !== null && deviation !== null ? round(middle - 2 * deviation) : null,
    adx14: round(calculateAdx(candles, 14)),
    atr14: round(calculateAtr(candles, 14)),
    volumeRatio: latest && volumeBaseline > 0 ? round(latest.volume / volumeBaseline) : null,
    support: supportWindow.length ? round(Math.min(...supportWindow.map(candle => candle.low))) : null,
    resistance: supportWindow.length ? round(Math.max(...supportWindow.map(candle => candle.high))) : null,
  };
}

function determineStatus(price: number, indicators: TechnicalIndicators): { status: SignalStatus; reasons: string[] } {
  const { ema9, ema21, ema50, ema200, rsi14, macdHistogram, adx14, volumeRatio } = indicators;
  if ([ema9, ema21, ema50, ema200, rsi14, macdHistogram, adx14, volumeRatio].some(value => value === null)) {
    return { status: "No Trade", reasons: ["Insufficient closed-candle history for the configured indicators."] };
  }
  const bullishTrend = ema9! > ema21! && ema21! > ema50! && price > ema200!;
  const bearishTrend = ema9! < ema21! && ema21! < ema50! && price < ema200!;
  const lowParticipation = volumeRatio! < 0.65;
  const exhausted = rsi14! >= 78 || rsi14! <= 22;
  if (lowParticipation || exhausted || adx14! < 12) {
    const reasons = [
      ...(lowParticipation ? ["Volume is below the participation threshold."] : []),
      ...(exhausted ? ["RSI is in an extreme zone."] : []),
      ...(adx14! < 12 ? ["ADX does not confirm a directional market."] : []),
    ];
    return { status: "No Trade", reasons };
  }
  if (bullishTrend && macdHistogram! > 0 && rsi14! >= 50 && adx14! >= 18) {
    return { status: "Bullish", reasons: ["EMA alignment, MACD momentum, RSI and ADX confirm the upside trend."] };
  }
  if (bearishTrend && macdHistogram! < 0 && rsi14! <= 50 && adx14! >= 18) {
    return { status: "Bearish", reasons: ["EMA alignment, MACD momentum, RSI and ADX confirm the downside trend."] };
  }
  return { status: "Neutral", reasons: ["Trend and momentum conditions are not sufficiently aligned."] };
}

function tradePlanFor(status: SignalStatus, price: number, indicators: TechnicalIndicators): TradePlan {
  const atr = indicators.atr14;
  const support = indicators.support;
  const resistance = indicators.resistance;
  if (atr === null || support === null || resistance === null || (status !== "Bullish" && status !== "Bearish")) {
    return { direction: null, entryLow: null, entryHigh: null, takeProfit: null, stopLoss: null };
  }
  if (status === "Bullish") {
    const entryLow = Math.max(support, price - atr * 0.65);
    const entryHigh = Math.min(price, entryLow + atr * 0.5);
    return {
      direction: "Long",
      entryLow: round(entryLow),
      entryHigh: round(entryHigh),
      takeProfit: round(Math.max(resistance, price + atr * 1.5)),
      stopLoss: round(Math.min(support - atr * 0.25, price - atr * 1.2)),
    };
  }
  const entryHigh = Math.min(resistance, price + atr * 0.65);
  const entryLow = Math.max(price, entryHigh - atr * 0.5);
  return {
    direction: "Short",
    entryLow: round(entryLow),
    entryHigh: round(entryHigh),
    takeProfit: round(Math.min(support, price - atr * 1.5)),
    stopLoss: round(Math.max(resistance + atr * 0.25, price + atr * 1.2)),
  };
}

export function calculateRiskScore(indicators: TechnicalIndicators, status: SignalStatus, agreement = 0): RiskScore {
  if (status === "No Trade") return "High";
  let riskPoints = 0;
  if ((indicators.adx14 ?? 0) < 20) riskPoints += 1;
  if ((indicators.rsi14 ?? 50) >= 70 || (indicators.rsi14 ?? 50) <= 30) riskPoints += 1;
  if ((indicators.volumeRatio ?? 0) < 1) riskPoints += 1;
  if (agreement < 60) riskPoints += 1;
  if (riskPoints >= 3) return "High";
  if (riskPoints >= 2) return "Medium";
  return "Low";
}

export function analyzeTimeframe(
  symbol: MarketSymbol,
  timeframe: Timeframe,
  candles: Candle[],
  observedAt = Date.now()
): SignalSnapshot {
  const closedCandles = candles.filter(candle => candle.closeTime < observedAt);
  const latest = closedCandles.at(-1);
  if (!latest) {
    throw new Error(`No closed ${timeframe} candle available for ${symbol}`);
  }
  const indicators = calculateIndicators(closedCandles);
  const result = determineStatus(latest.close, indicators);
  return {
    symbol,
    timeframe,
    candleOpenTime: latest.openTime,
    candleCloseTime: latest.closeTime,
    currentPrice: latest.close,
    status: result.status,
    riskScore: calculateRiskScore(indicators, result.status),
    confluenceScore: 0,
    indicators,
    plan: tradePlanFor(result.status, latest.close, indicators),
    freshness: evaluateFreshness(latest, timeframe, observedAt),
    reasons: result.reasons,
  };
}

export function applyCoinConfluence(snapshots: SignalSnapshot[]): SignalSnapshot[] {
  const totalWeight = snapshots.reduce((sum, snapshot) => sum + TIMEFRAME_WEIGHTS[snapshot.timeframe], 0);
  const bullishWeight = snapshots
    .filter(snapshot => snapshot.status === "Bullish")
    .reduce((sum, snapshot) => sum + TIMEFRAME_WEIGHTS[snapshot.timeframe], 0);
  const bearishWeight = snapshots
    .filter(snapshot => snapshot.status === "Bearish")
    .reduce((sum, snapshot) => sum + TIMEFRAME_WEIGHTS[snapshot.timeframe], 0);
  const leadingStatus: SignalStatus = bullishWeight >= bearishWeight ? "Bullish" : "Bearish";
  const leadingWeight = Math.max(bullishWeight, bearishWeight);
  const score = totalWeight > 0 ? Math.round((leadingWeight / totalWeight) * 100) : 0;
  return snapshots.map(snapshot => {
    const ownWeight = snapshot.status === leadingStatus ? TIMEFRAME_WEIGHTS[snapshot.timeframe] : 0;
    const agreement = totalWeight > 0 ? Math.round(((leadingWeight + ownWeight * 0.1) / totalWeight) * 100) : 0;
    return {
      ...snapshot,
      confluenceScore: score,
      riskScore: calculateRiskScore(snapshot.indicators, snapshot.status, agreement),
      reasons: [
        ...snapshot.reasons,
        `Multi-timeframe ${leadingStatus.toLowerCase()} confluence: ${score}%.`,
      ],
    };
  });
}
