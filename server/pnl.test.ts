import { describe, expect, it } from "vitest";
import { buildPnlRows, pnlRowsToCsv } from "../client/src/lib/pnl";

describe("P&L transformations", () => {
  const trades = [
    { id: 1, symbol: "BTCUSDT", status: "take_profit", pnlPercent: 1.25, closedAt: "2026-08-15T08:00:00.000Z" },
    { id: 2, symbol: "BTCUSDT", status: "stop_loss", pnlPercent: -0.5, closedAt: "2026-08-15T10:00:00.000Z" },
    { id: 3, symbol: "ETHUSDT", status: "take_profit", pnlPercent: 2, closedAt: "2026-08-16T10:00:00.000Z" },
    { id: 4, symbol: "BTCUSDT", status: "open", pnlPercent: 0, closedAt: null },
  ];

  it("filters by date and asset and computes cumulative P&L", () => {
    const rows = buildPnlRows(trades, "2026-08-15", "2026-08-16", "BTC");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: "2026-08-15", symbol: "BTC", pnl: 0.75, cumulativePnl: 0.75, count: 2, wins: 1, losses: 1 });
  });

  it("exports a stable CSV with header and rows", () => {
    const csv = pnlRowsToCsv(buildPnlRows(trades));
    expect(csv.split("\n")[0]).toBe("date,asset,pnl_percent,cumulative_pnl_percent,trade_count,wins,losses");
    expect(csv).toContain("2026-08-15,BTC,0.75,0.75,2,1,1");
    expect(csv.endsWith("\n")).toBe(true);
  });
});
