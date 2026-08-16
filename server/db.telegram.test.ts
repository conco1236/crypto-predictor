import { describe, expect, it, vi } from "vitest";

const { state, fakeDb } = vi.hoisted(() => {
  process.env.DATABASE_URL = "mysql://test";
  const state = { rows: [] as unknown[] };
  const limit = vi.fn(async () => state.rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy, limit }));
  const from = vi.fn(() => ({ where }));
  const fakeDb = {
    select: vi.fn(() => ({ from })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  };
  return { state, fakeDb };
});

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => fakeDb) }));

const { buildTelegramDeliveryRecord, clampHistoryLimit, createTelegramDeliveryLog, getHeartbeatHistory, getTelegramDeliveryHistory } = await import("./db");

describe("telegram database helpers", () => {
  it("builds a pending delivery record with zero attempts", () => {
    expect(buildTelegramDeliveryRecord({ userId: 1, taskUid: "task-1", exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, candleClosedAt: 4600, label: "Bullish", score: 72 })).toMatchObject({ userId: 1, taskUid: "task-1", exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, status: "pending", attempts: 0 });
  });

  it("keeps delivery identity fields distinct for exchange, symbol, interval and candle", () => {
    const first = buildTelegramDeliveryRecord({ userId: 1, exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, candleClosedAt: 4600, label: "Bullish", score: 72 });
    const second = buildTelegramDeliveryRecord({ userId: 1, exchange: "Bybit", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, candleClosedAt: 4600, label: "Bullish", score: 72 });
    const third = buildTelegramDeliveryRecord({ userId: 1, exchange: "Binance", symbol: "BTCUSDT", interval: "4h", candleOpenTime: 1000, candleClosedAt: 4600, label: "Bullish", score: 72 });
    expect(`${first.exchange}:${first.symbol}:${first.interval}:${first.candleOpenTime}`).not.toBe(`${second.exchange}:${second.symbol}:${second.interval}:${second.candleOpenTime}`);
    expect(`${first.exchange}:${first.symbol}:${first.interval}:${first.candleOpenTime}`).not.toBe(`${third.exchange}:${third.symbol}:${third.interval}:${third.candleOpenTime}`);
  });

  it("clamps history query limits to safe bounds", () => {
    expect(clampHistoryLimit(undefined, 30)).toBe(30);
    expect(clampHistoryLimit(0, 30)).toBe(1);
    expect(clampHistoryLimit(500, 30)).toBe(100);
  });

  it("reads delivery and heartbeat history through bounded select contracts", async () => {
    state.rows = [{ id: 1, status: "failed" }, { id: 2, status: "sent" }];
    await expect(getTelegramDeliveryHistory(1, 8)).resolves.toEqual(state.rows);
    state.rows = [{ id: 3, status: "success" }];
    await expect(getHeartbeatHistory(1, 5)).resolves.toEqual(state.rows);
    expect(fakeDb.select).toHaveBeenCalled();
  });

  it("returns an existing composite candle delivery without inserting a duplicate", async () => {
    state.rows = [{ id: 42, userId: 1, exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, status: "failed" }];
    const before = fakeDb.insert.mock.calls.length;
    const result = await createTelegramDeliveryLog({ userId: 1, taskUid: "task-1", exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, candleClosedAt: 4600, label: "Bullish", score: 72 });
    expect(result).toEqual(state.rows[0]);
    expect(fakeDb.insert.mock.calls.length).toBe(before);
  });
});
