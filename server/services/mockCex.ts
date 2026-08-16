export type MockExchange = "Binance" | "OKX";
export type MockSide = "Long" | "Short";

export type MockCredentialStatus = {
  exchange: MockExchange;
  configured: boolean;
  read: boolean;
  trade: boolean;
  withdraw: false;
  source: "mock";
  note: string;
};

export type DryRunOrderInput = {
  exchange: MockExchange;
  symbol: "BTCUSDT" | "ETHUSDT";
  side: MockSide;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  currentPrice: number;
  quantity: number;
  maxRiskPercent: number;
};

export type DryRunOrderResult = {
  ok: boolean;
  mode: "dry_run";
  exchange: MockExchange;
  symbol: DryRunOrderInput["symbol"];
  side: MockSide;
  simulatedOrderId: string;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
  projectedNotional: number;
  projectedRiskPercent: number;
  message: string;
};

const MOCK_BALANCE_USDT = 10_000;

export function getMockCredentialStatus(exchange: MockExchange): MockCredentialStatus {
  return {
    exchange,
    configured: true,
    read: true,
    trade: true,
    withdraw: false,
    source: "mock",
    note: "API giả lập nội bộ; không gọi mạng và không chứa secret thật.",
  };
}

export function validateDryRunOrder(input: DryRunOrderInput): DryRunOrderResult {
  const checks: DryRunOrderResult["checks"] = [];
  const credential = getMockCredentialStatus(input.exchange);
  checks.push({ name: "credential_read", passed: credential.read, detail: "Mock credential có quyền Read." });
  checks.push({ name: "credential_trade", passed: credential.trade, detail: "Mock credential có quyền Trade." });
  checks.push({ name: "credential_withdraw", passed: credential.withdraw === false, detail: "Withdraw luôn bị từ chối trong mock adapter." });
  checks.push({ name: "symbol", passed: ["BTCUSDT", "ETHUSDT"].includes(input.symbol), detail: "Chỉ cho phép BTCUSDT hoặc ETHUSDT." });
  checks.push({ name: "positive_values", passed: [input.entry, input.takeProfit, input.stopLoss, input.currentPrice, input.quantity].every(value => Number.isFinite(value) && value > 0), detail: "Giá và khối lượng phải là số dương." });

  const directionLevelsValid = input.side === "Long"
    ? input.takeProfit > input.entry && input.stopLoss < input.entry
    : input.takeProfit < input.entry && input.stopLoss > input.entry;
  checks.push({ name: "direction_levels", passed: directionLevelsValid, detail: "TP/SL phải phù hợp với hướng Long hoặc Short." });

  const projectedNotional = input.currentPrice * input.quantity;
  const distancePercent = Math.abs(input.entry - input.stopLoss) / input.entry * 100;
  const projectedRiskPercent = distancePercent * Math.min(projectedNotional / MOCK_BALANCE_USDT, 1);
  const riskValid = Number.isFinite(input.maxRiskPercent) && input.maxRiskPercent > 0 && input.maxRiskPercent <= 1 && projectedRiskPercent <= input.maxRiskPercent;
  checks.push({ name: "risk_limit", passed: riskValid, detail: `Rủi ro mô phỏng ${projectedRiskPercent.toFixed(3)}%, giới hạn ${input.maxRiskPercent.toFixed(3)}%.` });
  checks.push({ name: "mock_balance", passed: projectedNotional <= MOCK_BALANCE_USDT, detail: `Notional mô phỏng ${projectedNotional.toFixed(2)} USDT, số dư giả lập ${MOCK_BALANCE_USDT.toFixed(2)} USDT.` });

  const ok = checks.every(check => check.passed);
  return {
    ok,
    mode: "dry_run",
    exchange: input.exchange,
    symbol: input.symbol,
    side: input.side,
    simulatedOrderId: `dry-${input.exchange.toLowerCase()}-${Date.now()}`,
    checks,
    projectedNotional,
    projectedRiskPercent,
    message: ok ? "Dry-run đạt; chưa có lệnh nào được gửi ra ngoài." : "Dry-run bị từ chối; chưa có lệnh nào được gửi ra ngoài.",
  };
}
