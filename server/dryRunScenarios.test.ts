import { describe, expect, it } from "vitest";
import { readDryRunScenarios, readQuickLaunchScenarioId, upsertDryRunScenario, writeDryRunScenarios, writeQuickLaunchScenarioId, type DryRunScenario } from "../client/src/lib/dryRunScenarios";

const scenario: DryRunScenario = { id: "s1", name: "BTC conservative", exchange: "Binance", symbol: "BTCUSDT", side: "Long", entry: "100", takeProfit: "105", stopLoss: "98", currentPrice: "100", quantity: "0.001", maxRiskPercent: "1", updatedAt: 1 };

describe("dry-run scenarios", () => {
  it("reads invalid storage as empty and upserts without duplicates", () => {
    const storage = { getItem: () => "not-json" };
    expect(readDryRunScenarios(storage)).toEqual([]);
    const updated = upsertDryRunScenario({ ...scenario, name: "updated" }, [scenario]);
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe("updated");
  });

  it("writes at most 50 scenarios", () => {
    const values = Array.from({ length: 55 }, (_, index) => ({ ...scenario, id: `s${index}` }));
    let saved = "";
    writeDryRunScenarios(values, { setItem: (_key, value) => { saved = value; } });
    expect(JSON.parse(saved)).toHaveLength(50);
  });

  it("stores only a scenario ID for quick launch", () => {
    let saved = "";
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    writeQuickLaunchScenarioId("scenario-42", storage);
    expect(readQuickLaunchScenarioId(storage)).toBe("scenario-42");
    expect(saved).toBe("scenario-42");
  });
});
