export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type TrendLabel = "Bullish" | "Bearish" | "Neutral";
export type RiskLevel = "low" | "medium" | "high";

export type RiskAssessment = {
  score: number;
  level: RiskLevel;
  reasons: string[];
};

export type IndicatorSnapshot = {
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  adx: number;
  atr: number;
  volumeRatio: number;
  support: number;
  resistance: number;
  score: number;
  label: TrendLabel;
  reasons: string[];
};

const last = <T,>(values: T[]) => values[values.length - 1] as T;
const mean = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function sma(values: number[], period: number) {
  return values.map((_, i) => i + 1 < period ? NaN : mean(values.slice(i + 1 - period, i + 1)));
}

export function ema(values: number[], period: number) {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let i = 1; i < values.length; i++) result.push((values[i] - result[i - 1]) * multiplier + result[i - 1]);
  return result;
}

export function rsi(values: number[], period = 14) {
  if (values.length <= period) return values.map(() => 50);
  const result = values.map(() => 50);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta; else losses -= delta;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

export function trueRanges(candles: Candle[]) {
  return candles.map((c, i) => i === 0 ? c.high - c.low : Math.max(c.high - c.low, Math.abs(c.high - candles[i - 1].close), Math.abs(c.low - candles[i - 1].close)));
}

export function atr(candles: Candle[], period = 14) {
  return sma(trueRanges(candles), period).map((v, i) => Number.isFinite(v) ? v : trueRanges(candles).slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1));
}

export function bollinger(values: number[], period = 20, multiplier = 2) {
  const middle = sma(values, period).map((v, i) => Number.isFinite(v) ? v : mean(values.slice(0, i + 1)));
  return values.map((_, i) => {
    const sample = values.slice(Math.max(0, i + 1 - period), i + 1);
    const avg = middle[i];
    const deviation = Math.sqrt(mean(sample.map(v => (v - avg) ** 2)));
    return { middle: avg, upper: avg + deviation * multiplier, lower: avg - deviation * multiplier };
  });
}

export function macd(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const line = values.map((_, i) => fast[i] - slow[i]);
  const signal = ema(line, 9);
  return line.map((value, i) => ({ line: value, signal: signal[i], histogram: value - signal[i] }));
}

export function adx(candles: Candle[], period = 14) {
  if (candles.length < 2) return candles.map(() => 0);
  const tr = trueRanges(candles);
  const plus: number[] = [0];
  const minus: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    plus.push(up > down && up > 0 ? up : 0);
    minus.push(down > up && down > 0 ? down : 0);
  }
  return candles.map((_, i) => {
    const trAvg = mean(tr.slice(Math.max(0, i + 1 - period), i + 1)) || 1;
    const pdi = mean(plus.slice(Math.max(0, i + 1 - period), i + 1)) / trAvg * 100;
    const mdi = mean(minus.slice(Math.max(0, i + 1 - period), i + 1)) / trAvg * 100;
    return clamp(Math.abs(pdi - mdi) / Math.max(pdi + mdi, 1) * 100, 0, 100);
  });
}

export function analyzeCandles(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const e9 = last(ema(closes, 9)) ?? 0;
  const e21 = last(ema(closes, 21)) ?? 0;
  const e50 = last(ema(closes, 50)) ?? 0;
  const r = last(rsi(closes)) ?? 50;
  const m = last(macd(closes)) ?? { line: 0, signal: 0, histogram: 0 };
  const b = last(bollinger(closes)) ?? { middle: 0, upper: 0, lower: 0 };
  const a = last(atr(candles)) ?? 0;
  const adxValue = last(adx(candles)) ?? 0;
  const volumeRatio = (last(volumes) ?? 0) / (mean(volumes.slice(-20)) || 1);
  const recent = candles.slice(-30);
  const support = Math.min(...recent.map(c => c.low));
  const resistance = Math.max(...recent.map(c => c.high));
  let score = 0;
  const reasons: string[] = [];
  if (e9 > e21) { score += 15; reasons.push("EMA 9 nằm trên EMA 21"); } else { score -= 15; reasons.push("EMA 9 nằm dưới EMA 21"); }
  if (e21 > e50) { score += 15; reasons.push("EMA 21 nằm trên EMA 50"); } else { score -= 15; reasons.push("EMA 21 nằm dưới EMA 50"); }
  if (closes.at(-1)! > e50) { score += 12; reasons.push("Giá đang trên EMA 50"); } else { score -= 12; reasons.push("Giá đang dưới EMA 50"); }
  if (r >= 55 && r <= 72) { score += 12; reasons.push(`RSI ${r.toFixed(1)} ủng hộ đà tăng`); }
  else if (r <= 45 && r >= 28) { score -= 12; reasons.push(`RSI ${r.toFixed(1)} ủng hộ đà giảm`); }
  else if (r > 72) reasons.push(`RSI ${r.toFixed(1)} cảnh báo quá mua`);
  else if (r < 28) reasons.push(`RSI ${r.toFixed(1)} cảnh báo quá bán`);
  if (m.histogram > 0) { score += 12; reasons.push("MACD histogram dương"); } else { score -= 12; reasons.push("MACD histogram âm"); }
  if (closes.at(-1)! > b.middle) score += 8; else score -= 8;
  if (adxValue >= 20) { score += closes.at(-1)! >= e21 ? 10 : -10; reasons.push(`ADX ${adxValue.toFixed(1)} cho thấy xu hướng có lực`); }
  if (volumeRatio >= 1.2) reasons.push(`Khối lượng cao hơn trung bình ${((volumeRatio - 1) * 100).toFixed(0)}%`);
  score = clamp(Math.round(score), -100, 100);
  const label: TrendLabel = score >= 25 ? "Bullish" : score <= -25 ? "Bearish" : "Neutral";
  return { ema9: e9, ema21: e21, ema50: e50, rsi: r, macd: m.line, macdSignal: m.signal, macdHistogram: m.histogram, bollingerUpper: b.upper, bollingerMiddle: b.middle, bollingerLower: b.lower, adx: adxValue, atr: a, volumeRatio, support, resistance, score, label, reasons };
}

export function riskAssessment(snapshot: IndicatorSnapshot, candles: Candle[], levels: { entry: number; stopLoss: number }): RiskAssessment {
  const price = candles.at(-1)?.close ?? levels.entry;
  const atrPercent = price > 0 ? snapshot.atr / price * 100 : 0;
  const stopDistancePercent = levels.entry > 0 ? Math.abs(levels.entry - levels.stopLoss) / levels.entry * 100 : 0;
  let score = 0;
  const reasons: string[] = [];
  const volatilityPoints = clamp(Math.round(atrPercent * 14), 0, 35);
  score += volatilityPoints;
  if (volatilityPoints >= 20) reasons.push(`ATR ${atrPercent.toFixed(2)}% cho thấy biến động cao`);
  else if (volatilityPoints >= 10) reasons.push(`ATR ${atrPercent.toFixed(2)}% cho thấy biến động vừa`);
  const stopPoints = clamp(Math.round(stopDistancePercent * 8), 0, 25);
  score += stopPoints;
  if (stopPoints >= 15) reasons.push(`Khoảng Entry–Stop Loss rộng ${stopDistancePercent.toFixed(2)}%`);
  if (snapshot.adx < 20) { score += 18; reasons.push(`ADX ${snapshot.adx.toFixed(1)} thấp, xu hướng chưa rõ`); }
  else if (snapshot.adx < 25) { score += 8; reasons.push(`ADX ${snapshot.adx.toFixed(1)} chỉ ở mức trung bình`); }
  if (snapshot.volumeRatio < 0.8) { score += 10; reasons.push("Volume thấp hơn mức trung bình"); }
  if (snapshot.rsi > 75 || snapshot.rsi < 25) { score += 12; reasons.push(`RSI ${snapshot.rsi.toFixed(1)} đang ở vùng cực đoan`); }
  if (snapshot.label === "Neutral") { score += 12; reasons.push("Tín hiệu trung tính, độ xác nhận thấp"); }
  if (Math.abs(snapshot.score) < 40) { score += 8; reasons.push("Điểm xu hướng chưa đủ mạnh"); }
  score = clamp(Math.round(score), 0, 100);
  return { score, level: score >= 60 ? "high" : score >= 30 ? "medium" : "low", reasons: reasons.length ? reasons : ["Biến động và độ xác nhận đang trong vùng kiểm soát"] };
}

export function tradeLevels(snapshot: IndicatorSnapshot, candles: Candle[]) {
  const price = candles.at(-1)?.close ?? snapshot.ema21;
  const buffer = snapshot.atr * 0.25;
  const longBias = snapshot.score >= 25;
  const shortBias = snapshot.score <= -25;
  const entry = longBias ? Math.max(snapshot.support + buffer, Math.min(price, snapshot.ema21)) : shortBias ? Math.min(snapshot.resistance - buffer, Math.max(price, snapshot.ema21)) : price;
  const risk = Math.max(snapshot.atr * 1.5, price * 0.005);
  return {
    entry,
    takeProfit1: longBias ? entry + risk * 1.5 : shortBias ? entry - risk * 1.5 : entry + risk,
    takeProfit2: longBias ? entry + risk * 2.5 : shortBias ? entry - risk * 2.5 : entry - risk,
    stopLoss: longBias ? entry - risk : shortBias ? entry + risk : entry - risk,
    side: longBias ? "LONG" : shortBias ? "SHORT" : "WAIT",
  } as const;
}
