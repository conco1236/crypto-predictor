import { describe, expect, it } from "vitest";
import { filterAnalyses } from "../client/src/lib/riskFilter";

const analyses = [
  { exchange: "Binance", interval: "1h", risk: { level: "low" }, symbol: "BTCUSDT" },
  { exchange: "Bybit", interval: "1h", risk: { level: "high" }, symbol: "BTCUSDT" },
  { exchange: "Binance", interval: "4h", risk: { level: "medium" }, symbol: "ETHUSDT" },
];

describe("risk/exchange/timeframe filter", () => {
  it("combines all active filters", () => {
    expect(filterAnalyses(analyses, "1h", "Binance", "low")).toHaveLength(1);
    expect(filterAnalyses(analyses, "1h", "Tất cả", "high")).toHaveLength(1);
    expect(filterAnalyses(analyses, "4h", "Binance", "medium")).toHaveLength(1);
  });

  it("preserves refreshed risk classification and supports reset", () => {
    const refreshed = analyses.map(item => item.symbol === "BTCUSDT" && item.exchange === "Binance" ? { ...item, risk: { level: "high" } } : item);
    expect(filterAnalyses(refreshed, "1h", "Binance", "low")).toHaveLength(0);
    expect(filterAnalyses(refreshed, "1h", "Tất cả", "Tất cả")).toHaveLength(2);
  });
});
