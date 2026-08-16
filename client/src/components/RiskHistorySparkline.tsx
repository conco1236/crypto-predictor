import React, { useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { formatRiskHistoryPoint, getRiskHistoryPointAriaLabel } from "@/lib/riskHistory";

export type RiskHistorySparklinePoint = { score: number; candleClosedAt: number };

type Props = { points: RiskHistorySparklinePoint[]; level: string };

export default function RiskHistorySparkline({ points, level }: Props) {
  const stroke = level === "low" ? "#6ee7b7" : level === "high" ? "#fda4af" : "#fde68a";
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const data = points.map((point, index) => ({ index, score: point.score, candleClosedAt: point.candleClosedAt }));
  const renderTooltip = (point: RiskHistorySparklinePoint | undefined) => {
    if (!point) return null;
    const formatted = formatRiskHistoryPoint(point);
    return <div role="tooltip" className="max-w-[calc(100vw-2rem)] break-words rounded-lg border border-white/10 bg-[#101a2a] px-3 py-2 text-xs shadow-xl"><p className="text-slate-400">Nến đóng</p><p className="mt-0.5 font-medium text-slate-100">{formatted.time}</p><p className="mt-1 text-cyan-200">Rủi ro <span className="font-semibold">{formatted.score}</span></p></div>;
  };
  const tooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload?: RiskHistorySparklinePoint }> }) => renderTooltip(active ? payload?.[0]?.payload : undefined);
  const focusedPoint = focusedIndex === null ? undefined : data[focusedIndex];
  const dot = (props: { cx?: number; cy?: number; index?: number; payload?: RiskHistorySparklinePoint }) => {
    if (props.cx === undefined || props.cy === undefined || props.index === undefined || !props.payload) return <circle cx={0} cy={0} r={0} />;
    return <circle cx={props.cx} cy={props.cy} r={3} fill={stroke} tabIndex={0} role="img" aria-label={getRiskHistoryPointAriaLabel(props.payload)} onFocus={() => setFocusedIndex(props.index!)} onBlur={() => setFocusedIndex(null)} onMouseEnter={() => setFocusedIndex(props.index!)} onMouseLeave={() => setFocusedIndex(current => current === props.index ? null : current)} className="cursor-pointer outline-none focus:stroke-white focus:stroke-2" />;
  };
  return <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2" aria-label="Lịch sử điểm rủi ro theo nến; đường tham chiếu mức 33 và 66">
    <div className="mb-1 flex items-center justify-between"><p className="text-[10px] uppercase tracking-wider text-slate-500">Diễn biến điểm rủi ro</p><span className="text-[10px] text-slate-500">{points.length ? `${points.length} nến` : "Chưa có dữ liệu"}</span></div>
    {data.length >= 2 ? <div className="relative h-12 -mx-1"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 4, right: 4, bottom: 2, left: 4 }}><YAxis domain={[0, 100]} hide /><ReferenceLine y={33} stroke="#6ee7b7" strokeOpacity={0.45} strokeDasharray="3 3" label={{ value: "33", position: "insideLeft", fill: "#6ee7b7", fontSize: 8 }} /><ReferenceLine y={66} stroke="#fda4af" strokeOpacity={0.45} strokeDasharray="3 3" label={{ value: "66", position: "insideLeft", fill: "#fda4af", fontSize: 8 }} /><Tooltip content={tooltip} cursor={false} isAnimationActive={false} /><Line type="monotone" dataKey="score" stroke={stroke} strokeWidth={2} dot={dot} activeDot={{ r: 4, fill: stroke, stroke: "#07101d", strokeWidth: 2 }} isAnimationActive={false} /></LineChart></ResponsiveContainer>{focusedPoint && <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">{renderTooltip(focusedPoint)}</div>}</div> : <div className="flex h-12 items-center text-[11px] text-slate-500">Cần thêm snapshot sau các lần đóng nến để hiển thị xu hướng.</div>}
  </div>;
}
