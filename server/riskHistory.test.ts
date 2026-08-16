import { describe, expect, it, vi } from "vitest";
import { groupRiskSnapshots, parseRiskSnapshot } from "./db";
import * as db from "./db";
import { appRouter } from "./routers";
import { formatRiskHistoryPoint, getRiskHistoryPointAriaLabel } from "../client/src/lib/riskHistory";

describe("parseRiskSnapshot", () => {
  const createdAt = new Date("2026-08-16T00:00:00.000Z");

  it("parses candle timestamps and clamps risk score to 0-100", () => {
    expect(parseRiskSnapshot({ createdAt, indicators: JSON.stringify({ risk: { score: 118 }, candleOpenTime: 10, candleClosedAt: 20 }) })).toEqual({ candleOpenTime: 10, candleClosedAt: 20, score: 100 });
  });

  it("uses snapshot creation time when candle metadata is absent", () => {
    expect(parseRiskSnapshot({ createdAt, indicators: JSON.stringify({ risk: { score: 42 } }) })).toEqual({ candleOpenTime: createdAt.getTime(), candleClosedAt: createdAt.getTime(), score: 42 });
  });

  it("ignores malformed or missing risk payloads", () => {
    expect(parseRiskSnapshot({ createdAt, indicators: "not-json" })).toBeNull();
    expect(parseRiskSnapshot({ createdAt, indicators: JSON.stringify({ score: 42 }) })).toBeNull();
  });

  it("groups history by exchange, symbol and interval without mixing cards", () => {
    const rows = [
      { exchange: "Binance", symbol: "BTCUSDT", interval: "1h", createdAt, indicators: JSON.stringify({ risk: { score: 70 }, candleClosedAt: 100 }) },
      { exchange: "Bybit", symbol: "BTCUSDT", interval: "1h", createdAt, indicators: JSON.stringify({ risk: { score: 30 }, candleClosedAt: 200 }) },
      { exchange: "Binance", symbol: "BTCUSDT", interval: "4h", createdAt, indicators: JSON.stringify({ risk: { score: 55 }, candleClosedAt: 300 }) },
      { exchange: "Binance", symbol: "BTCUSDT", interval: "1h", createdAt, indicators: JSON.stringify({ risk: { score: 65 }, candleClosedAt: 400 }) },
    ];
    const grouped = groupRiskSnapshots(rows, 24);
    expect(Object.keys(grouped).sort()).toEqual(["Binance:BTCUSDT:1h", "Binance:BTCUSDT:4h", "Bybit:BTCUSDT:1h"]);
    expect(grouped["Binance:BTCUSDT:1h"].map(point => point.score)).toEqual([65, 70]);
    expect(grouped["Bybit:BTCUSDT:1h"].map(point => point.score)).toEqual([30]);
  });

  it("formats tooltip content with candle close time and detailed score", () => {
    const result = formatRiskHistoryPoint({ candleClosedAt: Date.parse("2026-08-16T05:06:07.000Z"), score: 67.8 });
    expect(result.time).toContain("2026");
    expect(result.score).toBe("68/100");
    expect(getRiskHistoryPointAriaLabel({ candleClosedAt: Date.parse("2026-08-16T05:06:07.000Z"), score: 67.8 })).toContain("điểm rủi ro 68/100");
  });

  it("calls market.riskHistories with the protected user context and returns grouped output", async () => {
    const mocked = vi.spyOn(db, "getRiskHistories").mockResolvedValue({ "Binance:BTCUSDT:1h": [{ candleOpenTime: 1, candleClosedAt: 2, score: 44 }] });
    const caller = appRouter.createCaller({ req: {} as any, res: {} as any, user: { id: 7, openId: "test", name: "Test", email: null, loginMethod: null, role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } });
    await expect(caller.market.riskHistories({ limitPerKey: 12 })).resolves.toEqual({ "Binance:BTCUSDT:1h": [{ candleOpenTime: 1, candleClosedAt: 2, score: 44 }] });
    expect(mocked).toHaveBeenCalledWith(7, 12);
    mocked.mockRestore();
  });
});
