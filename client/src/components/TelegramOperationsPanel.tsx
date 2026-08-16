import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { BellRing, History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

const symbols = ["*", "BTCUSDT", "ETHUSDT"];
const exchanges = ["*", "Binance", "Bybit", "OKX"];
const intervals = ["*", "15m", "1h", "4h", "1d"];
const statusText = (status: string) => status === "sent" ? "Đã gửi" : status === "failed" ? "Lỗi" : "Đang chờ";
const statusTone = (status: string) => status === "sent" ? "text-emerald-200" : status === "failed" ? "text-rose-200" : "text-amber-200";

export default function TelegramOperationsPanel() {
  const [symbol, setSymbol] = useState("*");
  const [exchange, setExchange] = useState("*");
  const [interval, setInterval] = useState("*");
  const [threshold, setThreshold] = useState("50");
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<"all" | "pending" | "sent" | "failed">("all");
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [heartbeatPage, setHeartbeatPage] = useState(1);
  const [logSymbol, setLogSymbol] = useState("");
  const [logExchange, setLogExchange] = useState("");
  const [logInterval, setLogInterval] = useState("");
  const rules = trpc.telegram.rules.useQuery(undefined, { refetchInterval: 30_000 });
  const delivery = trpc.telegram.deliveryHistoryPage.useQuery(useMemo(() => ({ page: deliveryPage, pageSize: 20, ...(status === "all" ? {} : { status }), ...(logSymbol ? { symbol: logSymbol } : {}), ...(logExchange ? { exchange: logExchange } : {}), ...(logInterval ? { interval: logInterval } : {}) }), [deliveryPage, status, logSymbol, logExchange, logInterval]), { refetchInterval: 30_000 });
  const heartbeats = trpc.telegram.heartbeatHistoryPage.useQuery({ page: heartbeatPage, pageSize: 10 }, { refetchInterval: 30_000 });
  const saveRule = trpc.telegram.saveRule.useMutation({ onSuccess: () => { toast.success("Đã lưu rule cảnh báo"); rules.refetch(); }, onError: error => toast.error(error.message) });
  const deleteRule = trpc.telegram.deleteRule.useMutation({ onSuccess: () => { toast.success("Đã xóa rule"); rules.refetch(); }, onError: error => toast.error(error.message) });
  const retry = trpc.telegram.retryDelivery.useMutation({ onSuccess: () => { toast.success("Đã gửi lại cảnh báo"); delivery.refetch(); }, onError: error => toast.error(error.message) });
  const save = () => saveRule.mutate({ symbol, exchange, interval, alertThreshold: Number(threshold), enabled });
  const resetDeliveryPage = (setter: (value: number) => void, value: string) => { setter(1); return value; };

  return <section className="grid gap-5 xl:grid-cols-[0.95fr_1.55fr]">
    <Card className="border-cyan-300/15 bg-[#0b1220]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-cyan-200" /> Rule cảnh báo theo phạm vi</CardTitle>
        <p className="text-xs leading-5 text-slate-500">Dùng * để tạo mặc định; rule cụ thể hơn sẽ được ưu tiên theo tài sản, sàn và khung thời gian.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div><Label className="text-[10px] text-slate-500">Tài sản</Label><select value={symbol} onChange={event => setSymbol(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200">{symbols.map(value => <option key={value}>{value}</option>)}</select></div>
          <div><Label className="text-[10px] text-slate-500">Sàn</Label><select value={exchange} onChange={event => setExchange(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200">{exchanges.map(value => <option key={value}>{value}</option>)}</select></div>
          <div><Label className="text-[10px] text-slate-500">Khung</Label><select value={interval} onChange={event => setInterval(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200">{intervals.map(value => <option key={value}>{value}</option>)}</select></div>
        </div>
        <div className="flex items-end gap-3"><div className="flex-1"><Label className="text-[10px] text-slate-500">Ngưỡng điểm tuyệt đối</Label><Input value={threshold} onChange={event => setThreshold(event.target.value)} type="number" min="25" max="100" className="mt-1 border-white/10 bg-black/20" /></div><div className="flex items-center gap-2 pb-2"><Switch checked={enabled} onCheckedChange={setEnabled} /><span className="text-xs text-slate-400">{enabled ? "Bật" : "Tắt"}</span></div><Button onClick={save} disabled={saveRule.isPending} className="bg-cyan-200 text-slate-950 hover:bg-cyan-100">{saveRule.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lưu rule"}</Button></div>
        <div className="space-y-2 border-t border-white/5 pt-3">{rules.data?.length ? rules.data.map(rule => <div key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/15 px-3 py-2 text-xs"><div><p className="text-slate-200">{rule.symbol} · {rule.exchange} · {rule.interval}</p><p className="mt-1 text-[10px] text-slate-500">Ngưỡng {rule.alertThreshold} · {rule.enabled ? "Đang bật" : "Đang tắt"}</p></div><Button variant="ghost" size="icon" onClick={() => deleteRule.mutate({ id: rule.id })} disabled={deleteRule.isPending} className="text-slate-500 hover:text-rose-200"><Trash2 className="h-3.5 w-3.5" /></Button></div>) : <p className="text-xs text-slate-500">Chưa có rule riêng; hệ thống dùng ngưỡng mặc định Telegram.</p>}</div>
      </CardContent>
    </Card>
    <Card className="border-white/5 bg-[#0d1421]/80">
      <CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-cyan-200" /> Nhật ký vận hành Telegram</CardTitle><Badge variant="outline" className="border-white/10 text-slate-400">{delivery.data?.items.length ?? 0} delivery · {heartbeats.data?.items.length ?? 0} Heartbeat</Badge></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4"><select value={status} onChange={event => { setStatus(event.target.value as typeof status); setDeliveryPage(1); }} className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200"><option value="all">Mọi trạng thái</option><option value="failed">Lỗi</option><option value="pending">Đang chờ</option><option value="sent">Đã gửi</option></select><select value={logSymbol} onChange={event => { setLogSymbol(event.target.value); setDeliveryPage(1); }} className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200"><option value="">Mọi tài sản</option>{symbols.slice(1).map(value => <option key={value} value={value}>{value.replace("USDT", "")}</option>)}</select><select value={logExchange} onChange={event => { setLogExchange(event.target.value); setDeliveryPage(1); }} className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200"><option value="">Mọi sàn</option>{exchanges.slice(1).map(value => <option key={value} value={value}>{value}</option>)}</select><select value={logInterval} onChange={event => { setLogInterval(event.target.value); setDeliveryPage(1); }} className="h-9 rounded-md border border-white/10 bg-black/20 px-2 text-xs text-slate-200"><option value="">Mọi khung</option>{intervals.slice(1).map(value => <option key={value} value={value}>{value}</option>)}</select></div>
        <div className="max-h-[330px] space-y-2 overflow-y-auto pr-1">{delivery.data?.items.length ? delivery.data.items.map(item => <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-white/5 bg-black/15 p-3 text-xs md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-slate-200">{item.exchange} · {item.symbol.replace("USDT", "")} · {item.interval}</span><span className={statusTone(item.status)}>{statusText(item.status)}</span></div><p className="mt-1 text-[10px] text-slate-500">Nến đóng {new Date(item.candleClosedAt).toLocaleString("vi-VN")} · điểm {item.score} · attempts {item.attempts}</p>{item.lastError && <p className="mt-1 line-clamp-2 text-[10px] text-rose-200">{item.lastError}</p>}</div>{item.status !== "sent" && <Button size="sm" variant="outline" onClick={() => retry.mutate({ id: item.id })} disabled={retry.isPending} className="border-cyan-300/20 bg-transparent text-cyan-200"><RotateCcw className="mr-1 h-3.5 w-3.5" /> Gửi lại</Button>}</div>) : <p className="py-6 text-center text-xs text-slate-500">Chưa có delivery phù hợp bộ lọc.</p>}</div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs"><div className="flex gap-2"><Button variant="outline" size="sm" disabled={deliveryPage <= 1} onClick={() => setDeliveryPage(page => Math.max(1, page - 1))} className="border-white/10 bg-transparent">Delivery trước</Button><Button variant="outline" size="sm" disabled={!delivery.data?.hasMore} onClick={() => setDeliveryPage(page => page + 1)} className="border-white/10 bg-transparent">Delivery sau</Button></div><span className="shrink-0 text-slate-500">Trang {deliveryPage}</span></div>
        <div className="border-t border-white/5 pt-3"><p className="mb-2 text-[10px] uppercase tracking-widest text-slate-500">Heartbeat gần nhất</p>{heartbeats.data?.items.map(run => <div key={run.id} className="flex items-center justify-between border-b border-white/5 py-2 text-xs last:border-0"><span className="text-slate-400">{new Date(run.startedAt).toLocaleString("vi-VN")} · saved {run.savedCount} · alerts {run.alertCount}</span><span className={run.status === "success" ? "text-emerald-200" : "text-rose-200"}>{run.status === "success" ? "OK" : run.error ?? "Lỗi"}</span></div>)}</div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3 text-xs"><div className="flex gap-2"><Button variant="outline" size="sm" disabled={heartbeatPage <= 1} onClick={() => setHeartbeatPage(page => Math.max(1, page - 1))} className="border-white/10 bg-transparent">Heartbeat trước</Button><Button variant="outline" size="sm" disabled={!heartbeats.data?.hasMore} onClick={() => setHeartbeatPage(page => page + 1)} className="border-white/10 bg-transparent">Heartbeat sau</Button></div><span className="shrink-0 text-slate-500">Trang {heartbeatPage}</span></div>
      </CardContent>
    </Card>
  </section>;
}
