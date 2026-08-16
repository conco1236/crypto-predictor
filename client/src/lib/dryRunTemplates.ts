import type { DryRunScenario, ScenarioInput } from "./dryRunScenarios";

export type RiskTemplate = "Conservative" | "Balanced" | "Aggressive";

const BASE: Omit<ScenarioInput, "entry" | "takeProfit" | "stopLoss" | "currentPrice" | "quantity" | "maxRiskPercent"> = {
  exchange: "Binance",
  symbol: "BTCUSDT",
  side: "Long",
};

export const DRY_RUN_TEMPLATES: Record<RiskTemplate, ScenarioInput> = {
  Conservative: { ...BASE, entry: "100", takeProfit: "103", stopLoss: "99", currentPrice: "100", quantity: "0.001", maxRiskPercent: "0.5" },
  Balanced: { ...BASE, entry: "100", takeProfit: "105", stopLoss: "98", currentPrice: "100", quantity: "0.001", maxRiskPercent: "1" },
  Aggressive: { ...BASE, entry: "100", takeProfit: "112", stopLoss: "95", currentPrice: "100", quantity: "0.002", maxRiskPercent: "1" },
};

export const RISK_TEMPLATE_COPY: Record<RiskTemplate, { label: string; description: string }> = {
  Conservative: { label: "Conservative", description: "Biên TP/SL hẹp hơn, khối lượng nhỏ và risk 0,5%. Phù hợp để làm quen." },
  Balanced: { label: "Balanced", description: "Cân bằng giữa biên lợi nhuận, stop loss và risk 1%. Dùng làm mặc định tham khảo." },
  Aggressive: { label: "Aggressive", description: "Biên biến động và khối lượng cao hơn, vẫn bị mock preflight kiểm soát." },
};

export function createTemplateScenario(template: RiskTemplate, now = Date.now()): DryRunScenario {
  const input = DRY_RUN_TEMPLATES[template];
  return { ...input, id: `template-${template.toLowerCase()}-${now}`, name: template, updatedAt: now };
}
