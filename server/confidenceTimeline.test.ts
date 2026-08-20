import { describe, expect, it, vi } from "vitest";
import { parseConfidenceSnapshot } from "./db";
import * as db from "./db";
import { appRouter } from "./routers";
import { ABRUPT_CONFIDENCE_DROP_POINTS, annotateConfidenceDrops, summarizeConfidenceTimeline } from "../client/src/lib/confidenceTimeline";
import { classifyConfidenceMomentum } from "../shared/confidenceMomentum";

describe("confidence timeline contracts", () => {
  const createdAt = new Date("2026-08-20T00:00:00.000Z");
  it("parses saved confidence and quality metadata without inferring missing confidence", () => {
    expect(parseConfidenceSnapshot({ label: "Bullish", createdAt, indicators: JSON.stringify({ confidence: 82, candleClosedAt: 120, signalQuality: { penalty: 12, isTradeEligible: true } }) })).toMatchObject({ confidence: 82, candleClosedAt: 120, penalty: 12, isTradeEligible: true, label: "Bullish" });
    expect(parseConfidenceSnapshot({ label: "Neutral", createdAt, indicators: JSON.stringify({ signalQuality: { penalty: 20 } }) })).toBeNull();
  });
  it("summarizes only supplied timeline observations", () => {
    expect(summarizeConfidenceTimeline([{ candleClosedAt: 1, confidence: 80, penalty: 0, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 2, confidence: 40, penalty: 25, isTradeEligible: false, label: "Neutral" }])).toEqual({ observations: 2, average: 60, min: 40, max: 80, gated: 1, abruptDrops: 1 });
  });
  it("marks only a consecutive confidence drop at or above the transparent threshold", () => {
    const annotated = annotateConfidenceDrops([{ candleClosedAt: 1, confidence: 80, penalty: 0, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 2, confidence: 68, penalty: 5, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 3, confidence: 53, penalty: 22, isTradeEligible: false, label: "Neutral" }]);
    expect(annotated.map(point => point.isAbruptDrop)).toEqual([false, false, true]);
    expect(annotated[2].dropMagnitude).toBe(ABRUPT_CONFIDENCE_DROP_POINTS);
  });
  it("classifies severe decline and quality gating as early-warning without changing signal status", () => {
    const critical = classifyConfidenceMomentum([{ candleClosedAt: 1, confidence: 76, penalty: 2, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 2, confidence: 60, penalty: 24, isTradeEligible: false, label: "Neutral" }]);
    expect(critical.status).toBe("critical");
    expect(critical.reason).toContain("giảm đột ngột");
    const stable = classifyConfidenceMomentum([{ candleClosedAt: 1, confidence: 70, penalty: 0, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 2, confidence: 67, penalty: 2, isTradeEligible: true, label: "Bullish" }]);
    expect(stable.status).toBe("stable");
  });
  it("queries the protected confidence history with asset, exchange, timeframe and user scope", async () => {
    const mocked = vi.spyOn(db, "getConfidenceHistory").mockResolvedValue([]);
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 9, openId: "timeline-user", name: "Timeline", email: null, loginMethod: null, role: "user", createdAt, updatedAt: createdAt, lastSignedIn: createdAt } });
    await expect(caller.market.confidenceHistory({ exchange: "OKX", symbol: "ETHUSDT", interval: "4h", limit: 24 })).resolves.toEqual([]);
    expect(mocked).toHaveBeenCalledWith(9, "OKX", "ETHUSDT", "4h", 24);
    mocked.mockRestore();
  });
  it("queries the protected early-warning queue with user scope and limit", async () => {
    const mocked = vi.spyOn(db, "getConfidenceEarlyWarnings").mockResolvedValue([]);
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 9, openId: "timeline-user", name: "Timeline", email: null, loginMethod: null, role: "user", createdAt, updatedAt: createdAt, lastSignedIn: createdAt } });
    await expect(caller.market.confidenceEarlyWarnings({ limit: 8 })).resolves.toEqual([]);
    expect(mocked).toHaveBeenCalledWith(9, 8);
    mocked.mockRestore();
  });
});
