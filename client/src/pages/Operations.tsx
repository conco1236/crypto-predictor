import { Activity, ArrowLeft, CheckCircle2, Clock3, RefreshCw, ShieldAlert, XCircle } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useTheme } from "@/contexts/ThemeContext";

function formatDate(value: Date | string | number | null | undefined) {
  return value ? new Date(value).toLocaleString("vi-VN") : "—";
}

export default function Operations() {
  const { theme, toggleTheme } = useTheme();
  const telegram = trpc.telegram.get.useQuery(undefined, { refetchInterval: 30_000 });
  const heartbeat = trpc.telegram.heartbeatHistory.useQuery({ limit: 20 }, { refetchInterval: 30_000 });
  const audit = trpc.paper.audit.useQuery({ limit: 100 }, { refetchInterval: 30_000 });
  const trades = trpc.paper.list.useQuery({ limit: 200 }, { refetchInterval: 30_000 });
  const lastRun = heartbeat.data?.[0];
  const health = useMemo(() => {
    if (!lastRun) return { label: "Chưa có dữ liệu", tone: "border-amber-500/30 text-amber-500", detail: "Heartbeat chưa ghi nhận lần chạy nào." };
    const age = Date.now() - new Date(lastRun.finishedAt).getTime();
    const healthy = lastRun.status === "success" && age < 2 * 60 * 60 * 1000;
    return healthy
      ? { label: "Healthy", tone: "border-emerald-500/30 text-emerald-500", detail: `Lần chạy thành công cách đây ${Math.max(0, Math.round(age / 60_000))} phút.` }
      : { label: lastRun.status === "failed" ? "Failed" : "Stale", tone: "border-rose-500/30 text-rose-500", detail: lastRun.status === "failed" ? lastRun.error ?? "Heartbeat báo lỗi." : "Heartbeat chưa chạy trong 2 giờ gần nhất." };
  }, [lastRun]);
  const reportRows = (audit.data ?? []).filter(item => item.action === "daily_pnl_report");
  const dailyPnl = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number; wins: number; losses: number }>();
    for (const trade of trades.data ?? []) {
      if (trade.status === "open" || !trade.closedAt) continue;
      const key = new Date(trade.closedAt).toISOString().slice(0, 10);
      const row = map.get(key) ?? { pnl: 0, count: 0, wins: 0, losses: 0 };
      row.pnl += Number(trade.pnlPercent ?? 0); row.count += 1;
      if (trade.status === "take_profit") row.wins += 1;
      if (trade.status === "stop_loss") row.losses += 1;
      map.set(key, row);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14);
  }, [trades.data]);
  const refreshAll = () => { void telegram.refetch(); void heartbeat.refetch(); void audit.refetch(); void trades.refetch(); };
  return <main className="min-h-screen bg-background px-4 py-6 text-foreground md:px-8"><div className="mx-auto max-w-6xl"><header className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Operations Center</p><h1 className="mt-2 text-3xl font-semibold">Heartbeat & P&L Health</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Theo dõi lịch chạy cảnh báo, lịch sử báo cáo sandbox và trạng thái vận hành mà không hiển thị secrets.</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Đổi giao diện">{theme === "dark" ? "☼" : "◐"}</Button><Button variant="outline" onClick={refreshAll}><RefreshCw className="mr-2 h-4 w-4" />Làm mới</Button><Button variant="outline" onClick={() => { window.location.href = "/?page=trading-bot"; }}><ArrowLeft className="mr-2 h-4 w-4" />Trading Bot</Button></div></header><div className="grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><div className="flex items-center justify-between"><Activity className="h-5 w-5 text-primary" /><Badge variant="outline" className={health.tone}>{health.label}</Badge></div><p className="mt-4 text-sm font-semibold">Signal Heartbeat</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{health.detail}</p></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><Clock3 className="h-5 w-5 text-primary" /><span className="text-xs text-muted-foreground">Task UID</span></div><p className="mt-4 break-all font-mono text-xs">{telegram.data?.scheduleCronTaskUid ?? "Chưa tạo"}</p><p className="mt-2 text-xs text-muted-foreground">Lần chạy gần nhất: {formatDate(lastRun?.finishedAt)}</p></CardContent></Card><Card><CardContent className="p-5"><div className="flex items-center justify-between"><ShieldAlert className="h-5 w-5 text-primary" /><span className="text-xs text-muted-foreground">Daily report</span></div><p className="mt-4 text-sm font-semibold">{telegram.data?.paperReportEnabled ? "Đang bật" : "Đang tắt"}</p><p className="mt-1 break-all text-xs text-muted-foreground">{telegram.data?.paperReportCronTaskUid ?? "Chưa có task báo cáo"}</p></CardContent></Card></div><Card className="mt-5"><CardHeader><CardTitle className="text-base">Lịch sử Heartbeat</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="text-muted-foreground"><tr><th className="p-2">Trạng thái</th><th className="p-2">Bắt đầu</th><th className="p-2">Kết thúc</th><th className="p-2">Alert</th><th className="p-2">Lỗi</th></tr></thead><tbody>{(heartbeat.data ?? []).map(run => <tr key={run.id} className="border-t border-border"><td className="p-2">{run.status === "success" ? <span className="inline-flex items-center gap-1 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" />Success</span> : <span className="inline-flex items-center gap-1 text-rose-500"><XCircle className="h-3.5 w-3.5" />Failed</span>}</td><td className="p-2">{formatDate(run.startedAt)}</td><td className="p-2">{formatDate(run.finishedAt)}</td><td className="p-2">{run.alertCount}</td><td className="max-w-[280px] truncate p-2 text-muted-foreground">{run.error ?? "—"}</td></tr>)}</tbody></table>{!heartbeat.data?.length && <p className="p-6 text-center text-xs text-muted-foreground">Chưa có lịch sử Heartbeat.</p>}</div></CardContent></Card><div className="mt-5 grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Lịch sử gửi báo cáo P&L</CardTitle></CardHeader><CardContent className="space-y-3">{reportRows.length ? reportRows.map(item => <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{item.action}</span><span className="text-[11px] text-muted-foreground">{formatDate(item.createdAt)}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>) : <p className="text-xs text-muted-foreground">Chưa có báo cáo P&L được ghi nhận.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-base">P&L sandbox theo ngày</CardTitle></CardHeader><CardContent>{dailyPnl.length ? <div className="space-y-2">{dailyPnl.map(([date, row]) => <div key={date} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3 text-xs"><div><p className="font-semibold">{date}</p><p className="mt-1 text-muted-foreground">{row.count} lệnh · TP {row.wins} · SL {row.losses}</p></div><span className={row.pnl >= 0 ? "font-semibold text-emerald-500" : "font-semibold text-rose-500"}>{row.pnl >= 0 ? "+" : ""}{row.pnl.toFixed(3)}%</span></div>)}</div> : <p className="text-xs text-muted-foreground">Chưa có lệnh sandbox đã đóng.</p>}</CardContent></Card></div></div></main>;
}
