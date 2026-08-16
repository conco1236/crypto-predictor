import { describe, expect, it } from "vitest";
import { getMockCredentialStatus, validateDryRunOrder } from "./mockCex";

describe("mock CEX adapter", () => {
  it("exposes only Read/Trade and never Withdraw", () => {
    for (const exchange of ["Binance", "OKX"] as const) {
      const status = getMockCredentialStatus(exchange);
      expect(status.source).toBe("mock");
      expect(status.read).toBe(true);
      expect(status.trade).toBe(true);
      expect(status.withdraw).toBe(false);
    }
  });

  it("accepts a safe Long dry-run without sending an order", () => {
    const result = validateDryRunOrder({ exchange: "Binance", symbol: "BTCUSDT", side: "Long", entry: 100, takeProfit: 105, stopLoss: 98, currentPrice: 100, quantity: 1, maxRiskPercent: 1 });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("dry_run");
    expect(result.message).toContain("chưa có lệnh nào được gửi");
  });

  it("rejects invalid Short levels and risk above the guard", () => {
    const result = validateDryRunOrder({ exchange: "OKX", symbol: "ETHUSDT", side: "Short", entry: 100, takeProfit: 90, stopLoss: 120, currentPrice: 100, quantity: 100, maxRiskPercent: 1 });
    expect(result.ok).toBe(false);
    expect(result.checks.find(check => check.name === "direction_levels")?.passed).toBe(true);
    expect(result.checks.find(check => check.name === "risk_limit")?.passed).toBe(false);
  });
});
