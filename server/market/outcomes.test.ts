import { describe, expect, it } from "vitest";
import { calibrateConfidence, evaluateSignalOutcome, summarizeOutcomes } from "./outcomes";

describe("signal outcome evaluation", () => {
  const base = { direction: "Bullish" as const, entry: 100, takeProfit: 105, stopLoss: 97, signalCandleOpenTime: 1_000 };

  it("resolves a bullish take-profit from future candles only", () => {
    const outcome = evaluateSignalOutcome(base, [{ openTime: 1_000, high: 110, low: 90, close: 100 }, { openTime: 2_000, high: 106, low: 99, close: 105 }]);
    expect(outcome.result).toBe("take_profit");
    expect(outcome.returnPercent).toBe(5);
  });

  it("resolves a bearish stop-loss", () => {
    const outcome = evaluateSignalOutcome({ direction: "Bearish", entry: 100, takeProfit: 95, stopLoss: 103, signalCandleOpenTime: 1 }, [{ openTime: 1, high: 100, low: 100, close: 100 }, { openTime: 2, high: 104, low: 98, close: 101 }]);
    expect(outcome.result).toBe("stop_loss");
    expect(outcome.returnPercent).toBe(-3);
  });

  it("uses conservative stop-first handling when both levels are touched", () => {
    const outcome = evaluateSignalOutcome(base, [{ openTime: 1_000, high: 100, low: 100, close: 100 }, { openTime: 2_000, high: 106, low: 96, close: 100 }]);
    expect(outcome.result).toBe("stop_loss");
    expect(outcome.reason).toContain("bảo thủ");
  });

  it("returns expired when the real candle window has no resolution", () => {
    const outcome = evaluateSignalOutcome({ ...base, maxCandles: 1 }, [{ openTime: 1_000, high: 100, low: 100, close: 100 }, { openTime: 2_000, high: 104, low: 98, close: 101 }, { openTime: 3_000, high: 106, low: 99, close: 105 }]);
    expect(outcome.result).toBe("expired");
    expect(outcome.candlesObserved).toBe(1);
    expect(outcome.horizonReturnPercent).toBeCloseTo(1);
  });

  it("calibrates confidence conservatively from resolved outcomes", () => {
    const outcomes = [evaluateSignalOutcome(base, [{ openTime: 1_000, high: 100, low: 100, close: 100 }, { openTime: 2_000, high: 106, low: 99, close: 105 }])];
    expect(calibrateConfidence(60, outcomes)).toMatchObject({ confidence: 60.8, sampleSize: 1 });
    expect(calibrateConfidence(60, []).sampleSize).toBe(0);
  });

  it("summarizes only resolved outcomes in hit rate and expectancy", () => {
    const outcomes = [
      evaluateSignalOutcome(base, [{ openTime: 1_000, high: 100, low: 100, close: 100 }, { openTime: 2_000, high: 106, low: 99, close: 105 }]),
      evaluateSignalOutcome(base, [{ openTime: 1_000, high: 100, low: 100, close: 100 }, { openTime: 2_000, high: 98, low: 96, close: 97 }]),
      evaluateSignalOutcome(base, [{ openTime: 1_000, high: 100, low: 100, close: 100 }, { openTime: 2_000, high: 104, low: 99, close: 101 }]),
    ];
    const summary = summarizeOutcomes(outcomes);
    expect(summary).toMatchObject({ total: 3, resolved: 2, wins: 1, losses: 1, expired: 1, hitRate: 0.5 });
    expect(summary.expectancyPercent).toBeCloseTo(1);
    expect(summary.horizonReturnPercent).toBeCloseTo(3);
  });
});
