import { describe, expect, it } from "vitest";
import { deriveWebhookUrl, formatTelegramSignal, isValidTelegramWebhookSecret, parseTelegramCommand } from "./telegram";
import { isAuthorizedMarketRefreshCron } from "./scheduled";
import { isDuplicateTelegramUpdateError } from "./db";
import type { SignalSnapshot } from "./signal-engine";

const fixture: SignalSnapshot = {
  symbol: "BTCUSDT",
  timeframe: "1h",
  candleOpenTime: 1,
  candleCloseTime: 2,
  currentPrice: 100_000,
  status: "Bullish",
  riskScore: "Low",
  confluenceScore: 80,
  indicators: { ema9: 1, ema21: 1, ema50: 1, ema200: 1, rsi14: 56, macd: 1, macdSignal: 1, macdHistogram: 1, bollingerUpper: 1, bollingerMiddle: 1, bollingerLower: 1, adx14: 24, atr14: 20, volumeRatio: 1.2, support: 90_000, resistance: 110_000 },
  plan: { direction: "Long", entryLow: 99_000, entryHigh: 99_500, takeProfit: 103_000, stopLoss: 97_500 },
  freshness: { stale: false, lastClosedCandleCloseTime: 2, expectedNextCandleCloseTime: 3, observedAt: 2, lagMs: 0 },
  reasons: [],
};

describe("Telegram signal commands", () => {
  it("accepts only the exact required /btc and /eth commands", () => {
    expect(parseTelegramCommand("/btc")).toBe("BTCUSDT");
    expect(parseTelegramCommand("  /ETH  ")).toBe("ETHUSDT");
    expect(parseTelegramCommand("/btc now")).toBeNull();
    expect(parseTelegramCommand("/bitcoin")).toBeNull();
  });

  it("formats a signal summary with the required labels and technical levels", () => {
    const message = formatTelegramSignal("BTCUSDT", [fixture]);
    expect(message).toContain("BTC/USDT SIGNAL");
    expect(message).toContain("Bullish");
    expect(message).toContain("Risk: <b>Low</b>");
    expect(message).toContain("Entry:");
    expect(message).toContain("TP:");
    expect(message).toContain("SL:");
  });

  it("requires a matching webhook secret and a matching enabled cron task", () => {
    expect(isValidTelegramWebhookSecret("abc_123", "abc_123")).toBe(true);
    expect(isValidTelegramWebhookSecret("abc_124", "abc_123")).toBe(false);
    expect(isAuthorizedMarketRefreshCron({ isCron: true, taskUid: "task-1" }, { enabled: true, scheduleCronTaskUid: "task-1" })).toBe(true);
    expect(isAuthorizedMarketRefreshCron({ isCron: false, taskUid: "task-1" }, { enabled: true, scheduleCronTaskUid: "task-1" })).toBe(false);
    expect(isAuthorizedMarketRefreshCron({ isCron: true, taskUid: "task-2" }, { enabled: true, scheduleCronTaskUid: "task-1" })).toBe(false);
    expect(isAuthorizedMarketRefreshCron({ isCron: true, taskUid: "task-1" }, undefined)).toBe(false);
    expect(isAuthorizedMarketRefreshCron({ isCron: true, taskUid: "task-1" }, { enabled: false, scheduleCronTaskUid: "task-1" })).toBe(false);
  });

  it("derives the webhook from a published HTTPS request domain without a public URL secret", () => {
    expect(deriveWebhookUrl({ protocol: "http", headers: { "x-forwarded-proto": "https", "x-forwarded-host": "signals.example.com" } })).toBe("https://signals.example.com/api/telegram/webhook");
    expect(() => deriveWebhookUrl({ protocol: "http", headers: { host: "signals.example.com" } })).toThrow("published HTTPS request domain");
  });

  it("identifies duplicate Telegram update failures so a retried delivery is not sent twice", () => {
    expect(isDuplicateTelegramUpdateError(new Error("Duplicate entry '123' for key telegram_delivery_update_unique"))).toBe(true);
    expect(isDuplicateTelegramUpdateError(new Error("Connection timed out"))).toBe(false);
  });
});
