import { describe, expect, it } from "vitest";
import { resolveAlertRule } from "./services/alertRules";

const defaults = { botToken: "token", chatId: "chat", alertThreshold: 50, enabled: 1 };

describe("alert rule resolution", () => {
  it("prefers exact asset/exchange/interval over wildcard defaults", () => {
    const result = resolveAlertRule(defaults, [
      { symbol: "*", exchange: "*", interval: "*", alertThreshold: 60, enabled: 1 },
      { symbol: "BTCUSDT", exchange: "Binance", interval: "1h", alertThreshold: 75, enabled: 0 },
    ], { symbol: "BTCUSDT", exchange: "Binance", interval: "1h" });
    expect(result.alertThreshold).toBe(75);
    expect(result.enabled).toBe(0);
  });

  it("falls back to Telegram defaults when no rule matches", () => {
    expect(resolveAlertRule(defaults, [{ symbol: "ETHUSDT", exchange: "OKX", interval: "4h", alertThreshold: 80, enabled: 1 }], { symbol: "BTCUSDT", exchange: "Binance", interval: "1h" })).toEqual(defaults);
  });
});
