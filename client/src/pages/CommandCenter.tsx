import { useMemo } from "react";
import { Activity, BellRing, ChevronLeft, Clock3, Gauge, LayoutDashboard, Loader2, Send, ShieldCheck, WalletCards } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { summarizeDelivery, summarizePaperPnL } from "@/lib/operationsSummary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const formatAge = (date: Date | string | null | undefined) => {
  if (!date) return "chưa có";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s trước` : seconds < 3600 ? `${Math.floor(seconds / 60)}m trước` : `${Math.floor(seconds / 3600)}h trước`;
};

export const deliveryDecisionTrace = (message: string | null, status: "pending" | "sent" | "failed", lastError: string | null) => {
  if (status === "failed") return `Lỗi delivery: ${lastError ?? "không rõ"}`;
  if (!message) return status === "pending" ? "Đang chờ delivery; chưa có nội dung tin nhắn." : "Đã gửi; không có decision trace được lưu.";
  if (/no\s*trade/i.test(message)) return "No Trade guardrail được ghi trong nội dung cảnh báo.";
  if (/quality|chất lượng|penalty/i.test(message)) return "Quality gate hoặc confidence penalty được ghi trong nội dung cảnh báo.";
  return "Tín hiệu theo candle-close; xem lịch sử tín hiệu để đọc decision trace đầy đủ.";
};

function Metric({ label, value, note, tone = "text-foreground" }: { label: string; value: string | number; note: string; tone?: string }) {
  return <Card className="border-border bg-card"><CardContent className="p-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{note}</p></CardContent></Card>;
}

export default function CommandCenter() {
  const { user, loading } = useAuth();
  const market = trpc.market.all.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 30_000 });
  const deliveries = trpc.telegram.deliveryHistory.useQuery({ limit: 20 }, { enabled: Boolean(user), refetchInterval: 30_000 });
  const heartbeats = trpc.telegram.heartbeatHistory.useQuery({ limit: 10 }, { enabled: Boolean(user), refetchInterval: 30_000 });
  const quality = trpc.telegram.qualityControls.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 30_000 });
  const paper = trpc.paper.list.useQuery({ limit: 100 }, { enabled: Boolean(user), refetchInterval: 30_000 });
  const delivery = useMemo(() => summarizeDelivery(deliveries.data ?? []), [deliveries.data]);
  const pnl = useMemo(() => summarizePaperPnL(paper.data ?? []), [paper.data]);
  const noTrade = (market.data ?? []).filter(item => item.signalStatus === "No Trade").length;
  const tradeEligible = (market.data ?? []).filter(item => item.signalStatus === "Trade").length;
  const lastHeartbeat = heartbeats.data?.[0];

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-background p-6 text-center"><div><p className="text-sm text-muted-foreground">Đăng nhập để xem Command Center của tài khoản.</p><Button className="mt-4" onClick={() => startLogin()}>Đăng nhập</Button></div></div>;

  return <main className="min-h-screen bg-background px-5 py-8 text-foreground"><div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><Button variant="ghost" size="sm" onClick={() => { window.location.href = "/?page=platform"; }}><ChevronLeft className="mr-1 h-4 w-4" /> Platform Overview</Button><p className="mt-5 text-xs font-semibold uppercase tracking-[.22em] text-primary">Professional operations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Command Center</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Tổng hợp tình trạng feed, Signal quality, Telegram delivery, Heartbeat và sandbox P&amp;L từ dữ liệu tài khoản hiện có.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => { window.location.href = "/?page=diagnostics"; }}><Activity className="mr-2 h-4 w-4" /> Diagnostics</Button><Button size="sm" onClick={() => { window.location.href = "/?page=operations"; }}><LayoutDashboard className="mr-2 h-4 w-4" /> Operations</Button></div></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Feed coverage" value={`${market.data?.length ?? 0}/24`} note={`${tradeEligible} Trade · ${noTrade} No Trade trong snapshot hiện tại`} tone={market.error ? "text-rose-500" : "text-primary"} /><Metric label="Telegram delivery" value={delivery.deliveryRate == null ? "—" : `${delivery.deliveryRate}%`} note={`${delivery.sent} sent · ${delivery.failed} failed · ${delivery.pending} pending`} tone={delivery.failed ? "text-amber-500" : "text-emerald-500"} /><Metric label="Heartbeat" value={lastHeartbeat?.status === "success" ? "Healthy" : lastHeartbeat ? "Attention" : "No run"} note={lastHeartbeat ? `${formatAge(lastHeartbeat.finishedAt ?? lastHeartbeat.startedAt)} · ${lastHeartbeat.alertCount ?? 0} alert` : "Chưa có heartbeat history"} tone={lastHeartbeat?.status === "success" ? "text-emerald-500" : "text-amber-500"} /><Metric label="Sandbox P&L" value={`${pnl.pnlPercent >= 0 ? "+" : ""}${pnl.pnlPercent.toFixed(2)}%`} note={`${pnl.closed} lệnh đóng · ${pnl.wins} thắng · ${pnl.losses} thua`} tone={pnl.pnlPercent >= 0 ? "text-emerald-500" : "text-rose-500"} /></section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary" /> Alert delivery drill-down</CardTitle></CardHeader><CardContent>{deliveries.isLoading && !deliveries.data ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : deliveries.data?.length ? <div className="space-y-2">{deliveries.data.slice(0, 8).map(item => <div key={item.id} className="grid gap-2 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-medium">{item.exchange} · {item.symbol.replace("USDT", "")} · {item.interval}</p><p className="mt-1 text-xs text-muted-foreground">{deliveryDecisionTrace(item.message, item.status, item.lastError)} · {item.attempts} attempts</p></div><div className="text-left text-xs text-muted-foreground sm:text-right"><p className={item.status === "sent" ? "text-emerald-500" : item.status === "failed" ? "text-rose-500" : "text-amber-500"}>{item.status}</p><p className="mt-1">{formatAge(item.createdAt)}</p></div></div>)}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Chưa có delivery cho tài khoản này.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" /> Quality posture</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">Alert threshold</p><p className="mt-2 text-2xl font-semibold">{quality.data?.globalThreshold ?? 20} điểm</p><p className="mt-1 text-xs text-muted-foreground">{quality.data?.overrides.length ?? 0} override theo sàn đang hoạt động</p></div><div className="rounded-xl border border-border bg-muted/20 p-4"><p className="text-[10px] uppercase tracking-[.16em] text-muted-foreground">Quality snapshot</p><p className="mt-2 text-2xl font-semibold">{quality.data?.preview.observations ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{quality.data?.preview.projectedAlerts ?? 0} alert theo các ngưỡng hiện tại; chỉ tính snapshot có penalty đã lưu.</p></div><Button variant="outline" className="w-full" onClick={() => { window.location.href = "/?page=quality-alerts"; }}><Gauge className="mr-2 h-4 w-4" /> Quản lý quality controls</Button></CardContent></Card></section>
    <section className="mt-5 grid gap-5 md:grid-cols-3"><Card><CardContent className="p-5"><Send className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">Alert discipline</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Delivery được ghi trạng thái, attempts và lỗi; retry vẫn theo candle-key để tránh gửi trùng.</p></CardContent></Card><Card><CardContent className="p-5"><Clock3 className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">UTC operations</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Heartbeat, quality history và report giữ timestamp UTC; giao diện hiển thị theo locale người dùng.</p></CardContent></Card><Card><CardContent className="p-5"><WalletCards className="h-5 w-5 text-primary" /><p className="mt-3 font-semibold">Sandbox only</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Paper/mock/dry-run không gửi lệnh thật; quyền Withdraw vẫn bị từ chối mặc định.</p></CardContent></Card></section>
  </div></main>;
}
