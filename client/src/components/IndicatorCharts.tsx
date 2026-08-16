import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Expand, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Candle = { openTime?: number; close: number };
type Point = { time: string; macd: number; signal: number; histogram: number; rsi: number };
type WindowSize = 30 | 60 | 120;

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
    return { time: candle.openTime ? new Date(candle.openTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : `${index + 1}`, macd: macd[index], signal: signal[index], histogram: macd[index] - signal[index], rsi: 100 - 100 / (1 + relativeStrength) };
  });
}

const tooltipStyle = { background: "var(--popover)", color: "var(--popover-foreground)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11 };

function IndicatorPair({ points, syncId, expanded = false }: { points: Point[]; syncId: string; expanded?: boolean }) {
  const height = expanded ? "h-[340px]" : "h-36";
  return <div className="grid gap-4 md:grid-cols-2"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">MACD · động lượng · 12/26/9</p><div className={height}><ResponsiveContainer width="100%" height="100%"><BarChart data={points} syncId={syncId}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" hide={expanded ? false : true} tick={{ fill: "currentColor", fontSize: 9 }} /><YAxis width={42} tick={{ fill: "currentColor", fontSize: 9 }} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="histogram" name="Histogram" fill="var(--primary)" opacity={0.65} /><Line type="monotone" dataKey="macd" name="MACD" stroke="#0ea5e9" dot={false} strokeWidth={1.5} /><Line type="monotone" dataKey="signal" name="Signal" stroke="#f59e0b" dot={false} strokeWidth={1.5} /></BarChart></ResponsiveContainer></div></div><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">RSI · động lượng · 30/70</p><div className={height}><ResponsiveContainer width="100%" height="100%"><LineChart data={points} syncId={syncId}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="time" hide={expanded ? false : true} tick={{ fill: "currentColor", fontSize: 9 }} /><YAxis domain={[0, 100]} width={32} tick={{ fill: "currentColor", fontSize: 9 }} /><ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" /><ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="rsi" name="RSI" stroke="var(--primary)" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div></div></div>;
}

export default function IndicatorCharts({ candles, windowSize, onWindowSizeChange, syncId }: { candles: Candle[]; windowSize: WindowSize; onWindowSizeChange: (value: WindowSize) => void; syncId: string }) {
  const [expanded, setExpanded] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const storageKey = `crypto-signal:candle-window:${syncId}`;
  useEffect(() => { const saved = Number(localStorage.getItem(storageKey)); if (saved === 30 || saved === 60 || saved === 120) onWindowSizeChange(saved); }, [storageKey, onWindowSizeChange]);
  const selectWindow = (value: WindowSize) => { localStorage.setItem(storageKey, String(value)); onWindowSizeChange(value); };
  const downloadCharts = async () => { if (!chartRef.current) return; const dataUrl = await toPng(chartRef.current, { cacheBust: true, pixelRatio: 2 }); const link = document.createElement("a"); link.download = `macd-rsi-${windowSize}-candles.png`; link.href = dataUrl; link.click(); };
  const points = useMemo(() => buildPoints(candles.slice(-windowSize)), [candles, windowSize]);
  if (points.length < 2) return <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">Chưa đủ nến thật để vẽ MACD/RSI.</div>;
  return <><div className="rounded-xl border border-border bg-muted/30 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chỉ báo động lượng · cursor đồng bộ với biểu đồ giá</p><div className="flex items-center gap-1"><span className="mr-1 text-[10px] text-muted-foreground">Nến</span>{([30, 60, 120] as WindowSize[]).map(value => <button key={value} type="button" onClick={() => selectWindow(value)} className={`rounded-md px-2 py-1 text-[10px] transition ${windowSize === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`} aria-pressed={windowSize === value}>{value}</button>)}<Button type="button" variant="ghost" size="icon" className="ml-1 h-7 w-7" onClick={() => setExpanded(true)} aria-label="Phóng to biểu đồ MACD và RSI"><Expand className="h-3.5 w-3.5" /></Button></div></div><IndicatorPair points={points} syncId={syncId} /></div><div role="dialog" aria-modal="true" aria-label="Biểu đồ MACD và RSI phóng to" className={expanded ? "fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" : "hidden"}><div ref={chartRef} className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border border-border bg-background p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><p className="text-sm font-semibold text-foreground">MACD và RSI · {windowSize} nến</p><p className="mt-1 text-xs text-muted-foreground">Di chuyển chuột trên một biểu đồ để đồng bộ thời điểm với biểu đồ còn lại.</p></div><div className="flex items-center gap-1"><Button type="button" variant="outline" size="sm" onClick={downloadCharts}>Tải PNG</Button><Button type="button" variant="ghost" size="icon" onClick={() => setExpanded(false)} aria-label="Đóng biểu đồ phóng to"><X className="h-4 w-4" /></Button></div></div><IndicatorPair points={points} syncId={syncId} expanded /></div></div></>;
}
