import { afterEach, describe, expect, it, vi } from "vitest";
import { formatSignalAlert, sendTelegramMessage } from "./telegram";
import type { MarketAnalysis } from "../market/binance";

const sample = {
  symbol: "BTCUSDT",
  interval: "1h",
  price: 65000,
  change24h: 2.5,
  candles: [],
  indicators: { label: "Bullish", score: 72, rsi: 61, adx: 28, atr: 400, volumeRatio: 1.4 },
  levels: { side: "LONG", entry: 64800, takeProfit1: 65400, takeProfit2: 66000, stopLoss: 64200 },
  updatedAt: Date.now(),
} as unknown as MarketAnalysis;

describe("telegram alerts", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("includes symbol, trend score and risk levels", () => {
    const message = formatSignalAlert(sample);
    expect(message).toContain("BTC");
    expect(message).toContain("Bullish");
    expect(message).toContain("72/100");
    expect(message).toContain("TP1");
    expect(message).toContain("SL");
    expect(message).toContain("không phải khuyến nghị đầu tư");
  });

  it("surfaces Telegram API description when delivery fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ ok: false, description: "chat not found" }) }));
    await expect(sendTelegramMessage("token", "chat", "hello")).rejects.toThrow("chat not found");
  });

  it("returns Telegram message id on successful delivery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 42 } }) }));
    await expect(sendTelegramMessage("token", "chat", "hello")).resolves.toMatchObject({ ok: true, result: { message_id: 42 } });
  });
});
