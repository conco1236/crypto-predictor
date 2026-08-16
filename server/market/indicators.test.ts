import { describe, expect, it } from "vitest";
import { analyzeCandles, ema, rsi, riskAssessment, tradeLevels, Candle } from "./indicators";

function candlesFrom(closes: number[]): Candle[] {
  return closes.map((close, index) => ({ openTime: index * 900000, open: close - 1, high: close + 2, low: close - 2, close, volume: 100 + index }));
}

describe("market indicators", () => {
  it("calculates EMA with the expected first seed", () => {
    expect(ema([10, 12, 14], 3)).toEqual([10, 11, 12.5]);
  });

  it("keeps RSI in the 0..100 range and treats a flat market as neutral RSI", () => {
    const values = Array.from({ length: 40 }, (_, index) => 100 + index * 2);
    const result = rsi(values);
    expect(result.at(-1)).toBe(100);
    expect(result.every(value => value >= 0 && value <= 100)).toBe(true);
    expect(rsi(Array.from({ length: 40 }, () => 100)).at(-1)).toBe(50);
  });

  it("classifies risk and returns explainable reasons", () => {
    const candles = candlesFrom(Array.from({ length: 120 }, (_, index) => 100 + index * 1.5));
    const market = analyzeCandles(candles);
    const levels = tradeLevels(market, candles);
    const risk = riskAssessment(market, candles, levels);
    expect(risk.score).toBeGreaterThanOrEqual(0);
    expect(risk.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high"]).toContain(risk.level);
    expect(risk.reasons.length).toBeGreaterThan(0);
  });

  it("returns a bullish score for a sustained rising market", () => {
    const market = analyzeCandles(candlesFrom(Array.from({ length: 120 }, (_, index) => 100 + index * 1.5)));
    expect(market.label).toBe("Bullish");
    expect(market.score).toBeGreaterThan(25);
    expect(market.resistance).toBeGreaterThan(market.support);
    expect(market.confidence).toBeGreaterThanOrEqual(0);
    expect(market.confidence).toBeLessThanOrEqual(100);
    expect(market.confidenceReasons.length).toBeGreaterThan(0);
    const levels = tradeLevels(market, candlesFrom(Array.from({ length: 120 }, (_, index) => 100 + index * 1.5)));
    expect(levels.side).toBe("LONG");
    expect(levels.takeProfit1).toBeGreaterThan(levels.entry);
    expect(levels.stopLoss).toBeLessThan(levels.entry);
  });
});
