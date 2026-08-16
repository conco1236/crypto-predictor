import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Candle = { openTime?: number; close: number };
type Point = { time: string; macd: number; signal: number; histogram: number; rsi: number };

function ema(values: number[], period: number) {
  if (!values.length) return [];
  const multiplier = 2 / (period + 1);
  const result = [values[0]];
  for (let index = 1; index < values.length; index++) result.push((values[index] - result[index - 1]) * multiplier + result[index - 1]);
  return result;
}

function buildPoints(candles: Candle[]): Point[] {
  const closes = candles.map(candle => candle.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macd = closes.map((_, index) => fast[index] - slow[index]);
  const signal = ema(macd, 9);
  return candles.map((candle, index) => {
    const windowStart = Math.max(0, index - 13);
    const changes = closes.slice(windowStart, index + 1).map((close, changeIndex, values) => changeIndex === 0 ? 0 : close - values[changeIndex - 1]);
    const gains = changes.slice(1).filter(change => change > 0);
    const losses = changes.slice(1).filter(change => change < 0).map(change => Math.abs(change));
    const averageGain = gains.reduce((sum, value) => sum + value, 0) / Math.max(gains.length, 1);
    const averageLoss = losses.reduce((sum, value) => sum + value, 0) / Math.max(losses.length, 1);
    const relativeStrength = averageLoss === 0 ? (averageGain > 0 ? 100 : 1) : averageGain / averageLoss;
    const rsi = 100 - 100 / (1 + relativeStrength);
    return { time: candle.openTime ? new Date(candle.openTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : `${index + 1}`, macd: macd[index], signal: signal[index], histogram: macd[index] - signal[index], rsi };
  });
}

const tooltipStyle = { background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 };

export default function IndicatorCharts({ candles }: { candles: Candle[] }) {
  const points = buildPoints(candles.slice(-60));
  if (points.length < 2) return <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">Chưa đủ nến thật để vẽ MACD/RSI.</div>;
  return <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-3 md:grid-cols-2"><div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">MACD · động lượng</p><span className="text-[10px] text-muted-foreground">12/26/9</span></div><div className="h-36"><ResponsiveContainer width="100%" height="100%"><BarChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" hide /><YAxis width={38} tick={{ fill: "currentColor", fontSize: 9 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="histogram" name="Histogram" fill="var(--primary)" opacity={0.65} /><Line type="monotone" dataKey="macd" name="MACD" stroke="#0ea5e9" dot={false} strokeWidth={1.5} /><Line type="monotone" dataKey="signal" name="Signal" stroke="#f59e0b" dot={false} strokeWidth={1.5} /></BarChart></ResponsiveContainer></div></div><div><div className="mb-2 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">RSI · động lượng</p><span className="text-[10px] text-muted-foreground">30 / 70</span></div><div className="h-36"><ResponsiveContainer width="100%" height="100%"><LineChart data={points}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" hide /><YAxis domain={[0, 100]} width={28} tick={{ fill: "currentColor", fontSize: 9 }} /><ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" /><ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="rsi" name="RSI" stroke="var(--primary)" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div></div></div>;
}
