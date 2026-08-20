import { describe, expect, it, vi } from "vitest";
import { parseConfidenceSnapshot } from "./db";
import * as db from "./db";
import { appRouter } from "./routers";
import { summarizeConfidenceTimeline } from "../client/src/lib/confidenceTimeline";

describe("confidence timeline contracts", () => {
  const createdAt = new Date("2026-08-20T00:00:00.000Z");
  it("parses saved confidence and quality metadata without inferring missing confidence", () => {
    expect(parseConfidenceSnapshot({ label: "Bullish", createdAt, indicators: JSON.stringify({ confidence: 82, candleClosedAt: 120, signalQuality: { penalty: 12, isTradeEligible: true } }) })).toMatchObject({ confidence: 82, candleClosedAt: 120, penalty: 12, isTradeEligible: true, label: "Bullish" });
    expect(parseConfidenceSnapshot({ label: "Neutral", createdAt, indicators: JSON.stringify({ signalQuality: { penalty: 20 } }) })).toBeNull();
  });
  it("summarizes only supplied timeline observations", () => {
    expect(summarizeConfidenceTimeline([{ candleClosedAt: 1, confidence: 80, penalty: 0, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 2, confidence: 40, penalty: 25, isTradeEligible: false, label: "Neutral" }])).toEqual({ observations: 2, average: 60, min: 40, max: 80, gated: 1 });
  });
  it("queries the protected confidence history with asset, exchange, timeframe and user scope", async () => {
    const mocked = vi.spyOn(db, "getConfidenceHistory").mockResolvedValue([]);
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 9, openId: "timeline-user", name: "Timeline", email: null, loginMethod: null, role: "user", createdAt, updatedAt: createdAt, lastSignedIn: createdAt } });
    await expect(caller.market.confidenceHistory({ exchange: "OKX", symbol: "ETHUSDT", interval: "4h", limit: 24 })).resolves.toEqual([]);
    expect(mocked).toHaveBeenCalledWith(9, "OKX", "ETHUSDT", "4h", 24);
    mocked.mockRestore();
  });
});
