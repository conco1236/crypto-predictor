import { describe, expect, it } from "vitest";
import { summarizeDelivery, summarizePaperPnL } from "../client/src/lib/operationsSummary";
import { deliveryDecisionTrace } from "../client/src/pages/CommandCenter";

describe("operations command center summaries", () => {
  it("summarizes real delivery states without counting missing rows as success", () => {
    expect(summarizeDelivery([{ status: "sent", attempts: 1, createdAt: new Date() }, { status: "failed", attempts: 2, createdAt: new Date() }])).toEqual({ total: 2, sent: 1, failed: 1, pending: 0, deliveryRate: 50 });
  });
  it("aggregates only closed sandbox trades for executive P&L", () => {
    expect(summarizePaperPnL([{ status: "take_profit", pnlPercent: 2 }, { status: "stop_loss", pnlPercent: -1 }, { status: "open", pnlPercent: 3 }])).toEqual({ closed: 2, pnlPercent: 1, wins: 1, losses: 1 });
  });
  it("shows a saved No Trade or quality decision trace without inventing a reason", () => {
    expect(deliveryDecisionTrace("No Trade: quality penalty cao", "sent", null)).toContain("No Trade");
    expect(deliveryDecisionTrace("quality penalty 25", "sent", null)).toContain("Quality gate");
    expect(deliveryDecisionTrace(null, "failed", "timeout")).toBe("Lỗi delivery: timeout");
  });
});
