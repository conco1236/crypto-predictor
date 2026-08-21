import { describe, expect, it } from "vitest";
import {
  analyzeTimeframe,
  applyCoinConfluence,
  calculateIndicators,
  calculateRiskScore,
  evaluateFreshness,
  SIGNAL_STATUSES,
  TIMEFRAMES,
  type Candle,
} from "./signal-engine";
import { uniqueClosedCandleSignals } from "./signal-service";

function makeCandles(direction: "up" | "down", count = 240): Candle[] {
  let priorClose = direction === "up" ? 100 : 300;
  const sign = direction === "up" ? 1 : -1;
  return Array.from({ length: count }, (_, index) => {
    const open = priorClose;
    const change = index === 0 ? 0 : index % 5 === 0 ? -1 : 0.45;
    const close = open + sign * change;
    priorClose = close;
    return {
      openTime: index * 60_000,
      closeTime: index * 60_000 + 59_999,
      open,
      high: Math.max(open, close) + 0.35,
      low: Math.min(open, close) - 0.35,
      close,
      volume: 100,
      quoteVolume: 10_000,
      trades: 100,
    };
  });
}

describe("signal engine", () => {
  it("keeps the required timeframe and status vocabulary", () => {
    expect(TIMEFRAMES).toEqual(["1m", "15m", "1h", "4h", "1d"]);
    expect(SIGNAL_STATUSES).toEqual(["Bullish", "Bearish", "Neutral", "No Trade"]);
  });

  it("calculates a bullish closed-candle signal with a usable trade plan", () => {
    const candles = makeCandles("up");
    const signal = analyzeTimeframe("BTCUSDT", "1m", candles, 240 * 60_000 + 15_000);
    expect(signal.status).toBe("Bullish");
    expect(signal.plan.direction).toBe("Long");
    expect(signal.indicators.ema200).not.toBeNull();
    expect(signal.indicators.rsi14).not.toBeNull();
    expect(signal.freshness.stale).toBe(false);
  });

  it("produces direct EMA, RSI, MACD, ATR and ADX outputs from adequate closed-candle data", () => {
    const indicators = calculateIndicators(makeCandles("up", 260));
    expect(indicators.ema9).not.toBeNull();
    expect(indicators.ema9!).toBeGreaterThan(indicators.ema21!);
    expect(indicators.rsi14).toBeGreaterThan(50);
    expect(indicators.rsi14).toBeLessThan(78);
    expect(indicators.macdHistogram).toBeGreaterThan(0);
    expect(indicators.atr14).toBeGreaterThan(0);
    expect(indicators.adx14).toBeGreaterThan(18);
  });

  it("assigns Low, Medium and High risk labels from controlled technical conditions", () => {
    const base = calculateIndicators(makeCandles("up", 260));
    expect(calculateRiskScore(base, "Bullish", 100)).toBe("Low");
    expect(calculateRiskScore({ ...base, adx14: 15, volumeRatio: 0.9, rsi14: 55 }, "Bullish", 100)).toBe("Medium");
    expect(calculateRiskScore(base, "No Trade", 100)).toBe("High");
  });

  it("marks a feed stale only after the next expected candle close has passed", () => {
    const candle = makeCandles("up", 1)[0];
    const fresh = evaluateFreshness(candle, "1m", candle.closeTime + 60_000 + 9_000);
    const stale = evaluateFreshness(candle, "1m", candle.closeTime + 60_000 + 10_001);
    expect(fresh.stale).toBe(false);
    expect(stale.stale).toBe(true);
    expect(stale.expectedNextCandleCloseTime).toBe(candle.closeTime + 60_000);
  });

  it("calculates multi-timeframe confluence without changing required statuses", () => {
    const at = 240 * 60_000 + 15_000;
    const source = makeCandles("up");
    const signals = TIMEFRAMES.map(timeframe => analyzeTimeframe("ETHUSDT", timeframe, source, at));
    const result = applyCoinConfluence(signals);
    expect(result.every(signal => signal.status === "Bullish")).toBe(true);
    expect(result.every(signal => signal.confluenceScore === 100)).toBe(true);
    expect(result.every(signal => ["Low", "Medium", "High"].includes(signal.riskScore))).toBe(true);
  });

  it("deduplicates identical closed-candle keys before history persistence", () => {
    const at = 240 * 60_000 + 15_000;
    const signal = analyzeTimeframe("BTCUSDT", "1m", makeCandles("up"), at);
    const updatedVersion = { ...signal, confluenceScore: 77 };
    const unique = uniqueClosedCandleSignals([signal, updatedVersion]);
    expect(unique).toHaveLength(1);
    expect(unique[0].confluenceScore).toBe(77);
  });
});
