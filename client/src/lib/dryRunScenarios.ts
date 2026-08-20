export type ScenarioInput = {
  exchange: "Binance" | "OKX";
  symbol: "BTCUSDT" | "ETHUSDT";
  side: "Long" | "Short";
  entry: string;
  takeProfit: string;
  stopLoss: string;
  currentPrice: string;
  quantity: string;
  maxRiskPercent: string;
};

export type DryRunScenario = ScenarioInput & {
  id: string;
  name: string;
  updatedAt: number;
  lastRun?: { ok: boolean; projectedRiskPercent: number; projectedNotional: number; runAt: number };
};

const STORAGE_KEY = "crypto-trend-signal:dry-run-scenarios";
const QUICK_LAUNCH_KEY = "crypto-trend-signal:dry-run-scenario-quick-launch";

export function readDryRunScenarios(storage: Pick<Storage, "getItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage): DryRunScenario[] {
  if (!storage) return [];
  try { const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export function writeDryRunScenarios(scenarios: DryRunScenario[], storage: Pick<Storage, "setItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  storage?.setItem(STORAGE_KEY, JSON.stringify(scenarios.slice(0, 50)));
}

export function upsertDryRunScenario(scenario: DryRunScenario, scenarios: DryRunScenario[]) {
  return [scenario, ...scenarios.filter(item => item.id !== scenario.id)].slice(0, 50);
}

export function readQuickLaunchScenarioId(storage: Pick<Storage, "getItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  return storage?.getItem(QUICK_LAUNCH_KEY) ?? "";
}

export function writeQuickLaunchScenarioId(id: string, storage: Pick<Storage, "setItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  storage?.setItem(QUICK_LAUNCH_KEY, id);
}
