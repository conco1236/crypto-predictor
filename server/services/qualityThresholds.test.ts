import { describe, expect, it } from "vitest";
import { buildQualityAlertPreview, resolveQualityThreshold } from "./qualityThresholds";

describe("quality threshold resolution and preview", () => {
  it("prefers a per-exchange override over the global threshold", () => {
    expect(resolveQualityThreshold("Bybit", 20, [{ exchange: "Bybit", threshold: 31 }])).toBe(31);
    expect(resolveQualityThreshold("OKX", 20, [{ exchange: "Bybit", threshold: 31 }])).toBe(20);
  });

  it("counts only persisted quality penalties without inventing missing observations", () => {
    const preview = buildQualityAlertPreview([
      { exchange: "Binance", indicators: JSON.stringify({ signalQuality: { penalty: 25 } }) },
      { exchange: "Bybit", indicators: JSON.stringify({ signalQuality: { penalty: 28 } }) },
      { exchange: "OKX", indicators: "{}" },
    ], 20, [{ exchange: "Bybit", threshold: 30 }]);
    expect(preview).toMatchObject({ observations: 2, projectedAlerts: 1 });
    expect(preview.byExchange.find(item => item.exchange === "Bybit")).toMatchObject({ threshold: 30, projectedAlerts: 0 });
  });
});
