import { describe, expect, it } from "vitest";
import { confirmTimeframeSignal } from "./multiTimeframe";

const item = (interval: "15m" | "1h" | "4h" | "1d", label: "Bullish" | "Bearish" | "Neutral", score = 55, adx = 28) => ({ interval, indicators: { label, score, adx } } as any);

describe("multi-timeframe signal confirmation", () => {
  it("allows a 15m trade only when 1h and 4h agree", () => {
    expect(confirmTimeframeSignal(item("15m", "Bullish"), [item("1h", "Bullish"), item("4h", "Bullish")])).toMatchObject({ status: "Trade", alignedIntervals: ["1h", "4h"] });
  });
  it("returns No Trade when a higher timeframe conflicts", () => {
    expect(confirmTimeframeSignal(item("15m", "Bullish"), [item("1h", "Bearish"), item("4h", "Bullish")])).toMatchObject({ status: "No Trade", conflictingIntervals: ["1h"] });
  });
  it("returns No Trade when current trend is neutral or weak", () => {
    expect(confirmTimeframeSignal(item("1h", "Neutral"), [item("4h", "Bullish"), item("1d", "Bullish")]).status).toBe("No Trade");
    expect(confirmTimeframeSignal(item("1h", "Bullish", 24), [item("4h", "Bullish"), item("1d", "Bullish")]).status).toBe("No Trade");
  });
});
