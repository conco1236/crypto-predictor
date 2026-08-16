import { describe, expect, it } from "vitest";
import { createTemplateScenario, DRY_RUN_TEMPLATES } from "../client/src/lib/dryRunTemplates";

describe("dry-run risk templates", () => {
  it("provides Conservative, Balanced and Aggressive defaults", () => {
    expect(Object.keys(DRY_RUN_TEMPLATES)).toEqual(["Conservative", "Balanced", "Aggressive"]);
    expect(DRY_RUN_TEMPLATES.Conservative.maxRiskPercent).toBe("0.5");
    expect(DRY_RUN_TEMPLATES.Balanced.maxRiskPercent).toBe("1");
    expect(Number(DRY_RUN_TEMPLATES.Aggressive.quantity)).toBeGreaterThan(Number(DRY_RUN_TEMPLATES.Conservative.quantity));
  });

  it("creates a starter scenario without credentials or secrets", () => {
    const scenario = createTemplateScenario("Balanced", 123);
    expect(scenario).toMatchObject({ id: "template-balanced-123", name: "Balanced", updatedAt: 123, symbol: "BTCUSDT" });
    expect(JSON.stringify(scenario)).not.toMatch(/secret|apiKey|token|passphrase/i);
  });
});
