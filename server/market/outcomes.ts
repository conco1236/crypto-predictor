export type OutcomeDirection = "Bullish" | "Bearish" | "Neutral";

export type OutcomeCandle = {
  openTime: number;
  high: number;
  low: number;
  close: number;
};

export type SignalOutcomeInput = {
  direction: OutcomeDirection;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  signalCandleOpenTime: number;
  maxCandles?: number;
};

export type SignalOutcome = {
  result: "take_profit" | "stop_loss" | "expired" | "invalid";
  direction: OutcomeDirection;
  signalCandleOpenTime: number;
  exitCandleOpenTime?: number;
  exitPrice?: number;
  returnPercent: number;
  horizonReturnPercent?: number;
  candlesObserved: number;
  reason: string;
};

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;

export function evaluateSignalOutcome(input: SignalOutcomeInput, candles: OutcomeCandle[]): SignalOutcome {
  const base = { direction: input.direction, signalCandleOpenTime: input.signalCandleOpenTime };
  if (input.direction === "Neutral" || !finitePositive(input.entry) || !finitePositive(input.takeProfit) || !finitePositive(input.stopLoss) || input.takeProfit === input.stopLoss) {
    return { ...base, result: "invalid", returnPercent: 0, candlesObserved: 0, reason: "Tín hiệu trung lập hoặc mức giá không hợp lệ" };
  }
  if (candles.length > 0 && input.signalCandleOpenTime < candles[0].openTime) {
    return { ...base, result: "invalid", returnPercent: 0, candlesObserved: 0, reason: "Snapshot nằm ngoài cửa sổ nến lịch sử đã fetch; không đủ dữ liệu để đánh giá" };
  }
  const future = candles.filter(c => c.openTime > input.signalCandleOpenTime && Number.isFinite(c.high) && Number.isFinite(c.low));
  const maxCandles = Math.max(1, Math.min(input.maxCandles ?? 16, 200));
  const observed = future.slice(0, maxCandles);
  const bullish = input.direction === "Bullish";
  const target = bullish ? input.takeProfit : input.takeProfit;
  const stop = input.stopLoss;
  for (let index = 0; index < observed.length; index++) {
    const candle = observed[index];
    const touchedTarget = bullish ? candle.high >= target : candle.low <= target;
    const touchedStop = bullish ? candle.low <= stop : candle.high >= stop;
    if (touchedTarget || touchedStop) {
      // OHLC does not reveal intrabar order. Treat simultaneous touches as stop-first.
      const hitStop = touchedStop && touchedTarget ? true : touchedStop;
      const result = hitStop ? "stop_loss" : "take_profit";
      const exitPrice = hitStop ? stop : target;
      const returnPercent = (bullish ? (exitPrice - input.entry) : (input.entry - exitPrice)) / input.entry * 100;
      return { ...base, result, exitCandleOpenTime: candle.openTime, exitPrice, returnPercent, candlesObserved: index + 1, reason: touchedStop && touchedTarget ? "Cùng một nến chạm TP và SL; áp dụng giả định bảo thủ SL trước" : hitStop ? "Giá chạm Stop Loss" : "Giá chạm Take Profit" };
    }
  }
  const lastObserved = observed.at(-1);
  const horizonReturnPercent = lastObserved && finitePositive(input.entry)
    ? (bullish ? (lastObserved.close - input.entry) : (input.entry - lastObserved.close)) / input.entry * 100
    : 0;
  return { ...base, result: "expired", returnPercent: 0, horizonReturnPercent, candlesObserved: observed.length, reason: observed.length ? "Chưa chạm TP/SL trong cửa sổ đánh giá; dùng P&L tại cuối horizon để tham khảo" : "Chưa có nến tương lai đã đóng" };
}

export function calibrateConfidence(baseConfidence: number, outcomes: SignalOutcome[]) {
  const summary = summarizeOutcomes(outcomes);
  const safeBase = Number.isFinite(baseConfidence) ? Math.max(0, Math.min(100, baseConfidence)) : 50;
  if (summary.resolved === 0 || summary.hitRate == null) return { confidence: safeBase, sampleSize: 0, method: "Chưa đủ outcome đã giải quyết" };
  const weight = Math.min(summary.resolved / 50, 1);
  const confidence = safeBase * (1 - weight) + summary.hitRate * 100 * weight;
  return { confidence: Math.round(confidence * 10) / 10, sampleSize: summary.resolved, method: `Shrinkage ${Math.round(weight * 100)}% theo ${summary.resolved} outcome` };
}

export function summarizeOutcomes(outcomes: SignalOutcome[]) {
  const valid = outcomes.filter(outcome => outcome.result !== "invalid");
  const resolved = valid.filter(outcome => outcome.result === "take_profit" || outcome.result === "stop_loss");
  const wins = resolved.filter(outcome => outcome.result === "take_profit").length;
  const losses = resolved.filter(outcome => outcome.result === "stop_loss").length;
  const totalReturnPercent = resolved.reduce((sum, outcome) => sum + outcome.returnPercent, 0);
  const horizonReturnPercent = valid.reduce((sum, outcome) => sum + (outcome.result === "expired" ? (outcome.horizonReturnPercent ?? 0) : outcome.returnPercent), 0);
  let equity = 0;
  let peak = 0;
  let maxDrawdownPercent = 0;
  for (const outcome of resolved) {
    equity += outcome.returnPercent;
    peak = Math.max(peak, equity);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, peak - equity);
  }
  return {
    total: outcomes.length,
    valid: valid.length,
    resolved: resolved.length,
    wins,
    losses,
    expired: valid.filter(outcome => outcome.result === "expired").length,
    hitRate: resolved.length ? wins / resolved.length : null,
    expectancyPercent: resolved.length ? totalReturnPercent / resolved.length : null,
    totalReturnPercent,
    horizonReturnPercent,
    maxDrawdownPercent,
  };
}
