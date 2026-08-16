import { describe, expect, it } from "vitest";
import { getRiskTooltipDetails } from "../client/src/lib/riskTooltip";

describe("risk score tooltip details", () => {
  it("explains all risk components in Vietnamese", () => {
    const details = getRiskTooltipDetails({ atr: 123.4567, adx: 28.4, volumeRatio: 1.37, rsi: 61.2, entry: 100, stopLoss: 95 });
    expect(details.map(([label]) => label)).toEqual(["ATR / biến động", "ADX / xu hướng", "Volume", "RSI", "Entry → Stop Loss"]);
    expect(details.every(([, text]) => text.length > 10)).toBe(true);
    expect(details[4]?.[1]).toContain("5.0000");
  });
});
