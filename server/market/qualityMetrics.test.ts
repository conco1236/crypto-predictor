import { describe, expect, it } from "vitest";
import { summarizeQualityBacktest } from "./qualityMetrics";

const win = { result: "take_profit" as const, direction: "Bullish" as const, signalCandleOpenTime: 1, returnPercent: 2, candlesObserved: 1, reason: "TP" };
const loss = { result: "stop_loss" as const, direction: "Bullish" as const, signalCandleOpenTime: 2, returnPercent: -1, candlesObserved: 1, reason: "SL" };

describe("quality backtest metrics", () => {
  it("separates eligible and gated outcomes by asset/timeframe", () => {
    const result = summarizeQualityBacktest([
      { exchange: "Binance", symbol: "BTCUSDT", interval: "1h", quality: { penalty: 4, isTradeEligible: true }, outcome: win },
      { exchange: "Bybit", symbol: "BTCUSDT", interval: "1h", quality: { penalty: 28, isTradeEligible: false }, outcome: loss },
    ]);
    expect(result.byAssetTimeframe["BTCUSDT:1h"]).toMatchObject({ observations: 2, eligible: 1, gated: 1, averagePenalty: 16 });
    expect(result.byAssetTimeframe["BTCUSDT:1h"].eligibleOutcomes.wins).toBe(1);
  });

  it("summarizes actual penalty observations by exchange without creating missing data", () => {
    const result = summarizeQualityBacktest([{ exchange: "OKX", symbol: "ETHUSDT", interval: "4h", quality: { penalty: 22, isTradeEligible: false }, outcome: loss }]);
    expect(result.penaltyByExchange.OKX).toMatchObject({ observations: 1, averagePenalty: 22, highPenaltyCount: 1, maxPenalty: 22 });
    expect(result.observations).toBe(1);
  });
});
