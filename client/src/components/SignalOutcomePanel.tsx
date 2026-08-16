import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, ShieldCheck } from "lucide-react";

const pct = (value: number | null | undefined) => value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const signed = (value: number | null | undefined) => value == null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

export default function SignalOutcomePanel() {
  const metrics = trpc.market.outcomeMetrics.useQuery({ limit: 24 }, { refetchInterval: 60_000, staleTime: 30_000 });
  const summary = metrics.data?.summary;
  return <Card className="border-white/5 bg-[#0d1421]/80">
    <CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-cyan-200" /> Kiểm chứng tín hiệu</CardTitle><Badge variant="outline" className="border-cyan-300/20 text-cyan-200">Nến thật</Badge></CardHeader>
    <CardContent className="space-y-4">
      {metrics.isLoading ? <div className="flex items-center gap-2 py-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang đối chiếu nến tương lai...</div> : metrics.error ? <p className="text-sm text-amber-200">Chưa thể lấy dữ liệu kiểm chứng từ sàn. Hãy thử lại sau.</p> : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5"><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Hit rate</p><p className="mt-1 text-xl font-semibold text-white">{pct(summary?.hitRate)}</p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Đã giải quyết</p><p className="mt-1 text-xl font-semibold text-white">{summary?.resolved ?? 0}<span className="text-xs text-slate-500"> / {summary?.valid ?? 0}</span></p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Expectancy</p><p className={`mt-1 text-xl font-semibold ${(summary?.expectancyPercent ?? 0) >= 0 ? "text-emerald-200" : "text-rose-200"}`}>{signed(summary?.expectancyPercent)}</p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Hết hạn</p><p className="mt-1 text-xl font-semibold text-white">{summary?.expired ?? 0}</p></div><div className="rounded-xl bg-white/[0.03] p-3"><p className="text-[10px] uppercase tracking-widest text-slate-500">Max DD</p><p className="mt-1 text-xl font-semibold text-rose-200">{summary?.maxDrawdownPercent.toFixed(2) ?? "0.00"}%</p></div></div>
        <div className="flex items-start gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/5 p-3 text-xs leading-5 text-slate-400"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" /><span>{metrics.data?.note} Confidence sau calibration: <strong className="text-cyan-200">{metrics.data?.calibration.confidence.toFixed(1)}/100</strong> · {metrics.data?.calibration.method}. Đây chưa phải xác suất dự báo; cần thêm mẫu lịch sử trước khi dùng để hiệu chỉnh tự động.</span></div><div className="grid gap-2 sm:grid-cols-2">{Object.entries(metrics.data?.breakdown ?? {}).slice(0, 6).map(([key, item]) => <div key={key} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/15 px-3 py-2 text-xs"><span className="text-slate-400">{key}</span><span className="text-slate-200">{pct(item.hitRate)} · DD {item.maxDrawdownPercent.toFixed(2)}%</span></div>)}</div>
      </>}
    </CardContent>
  </Card>;
}
