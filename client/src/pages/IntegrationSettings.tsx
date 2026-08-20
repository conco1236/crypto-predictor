import { useEffect, useState } from "react";
import { ArrowLeft, Bot, CheckCircle2, KeyRound, Loader2, Save, Send, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type AiMode = "workspace_auto" | "workspace_model" | "manual_api";

export default function IntegrationSettings() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const telegram = trpc.telegram.get.useQuery(undefined, { enabled: Boolean(user) });
  const technicalAi = trpc.news.technicalAiSettings.useQuery(undefined, { enabled: Boolean(user) });
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [alertThreshold, setAlertThreshold] = useState("50");
  const [qualityThreshold, setQualityThreshold] = useState("20");
  const [sendMode, setSendMode] = useState<"all_candles" | "strong_only">("all_candles");
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [aiMode, setAiMode] = useState<AiMode>("workspace_auto");
  const [aiModel, setAiModel] = useState("gpt-5-nano");
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [quotaStatus, setQuotaStatus] = useState<{ status: "quota" | "rate_limit" | "unavailable"; remaining?: number; limit?: number; unit?: string; reset?: string } | null>(null);
  const [quotaAlertEnabled, setQuotaAlertEnabled] = useState(true);
  const [quotaAlertThreshold, setQuotaAlertThreshold] = useState("10");

  useEffect(() => {
    if (!telegram.data) return;
    setChatId(telegram.data.chatId);
    setAlertThreshold(String(telegram.data.alertThreshold));
    setQualityThreshold(String(telegram.data.qualityAlertThreshold ?? 20));
    setSendMode(telegram.data.sendMode ?? "all_candles");
    setTelegramEnabled(Boolean(telegram.data.enabled));
  }, [telegram.data]);
  useEffect(() => {
    if (!technicalAi.data?.settings) return;
    setAiMode(technicalAi.data.settings.mode);
    setAiModel(technicalAi.data.settings.model);
    setApiBaseUrl(technicalAi.data.settings.apiBaseUrl ?? "");
    setQuotaAlertEnabled(Boolean(technicalAi.data.settings.quotaAlertEnabled));
    setQuotaAlertThreshold(String(technicalAi.data.settings.quotaAlertThresholdPercent ?? 10));
  }, [technicalAi.data]);

  const saveTelegram = trpc.telegram.save.useMutation({
    onSuccess: async () => { setBotToken(""); await utils.telegram.get.invalidate(); toast.success("Đã lưu cài đặt Telegram"); },
    onError: error => toast.error(error.message),
  });
  const testTelegram = trpc.telegram.test.useMutation({ onSuccess: () => toast.success("Đã gửi tin nhắn kiểm tra Telegram"), onError: error => toast.error(error.message) });
  const saveAi = trpc.news.saveTechnicalAiSettings.useMutation({
    onSuccess: async () => { setApiKey(""); await utils.news.technicalAiSettings.invalidate(); toast.success("Đã lưu cài đặt AI technical analysis"); },
    onError: error => toast.error(error.message),
  });
  const testAiConnection = trpc.news.testTechnicalAiConnection.useMutation({
    onSuccess: result => { setQuotaStatus(result.quota); toast.success(`Manual API hoạt động · ${result.model} · ${result.latencyMs}ms`); },
    onError: error => toast.error(error.message),
  });
  const workspaceModels = technicalAi.data?.models ?? [];
  const autoModels = workspaceModels.filter(model => model.autoEligible);
  const configuredTelegram = Boolean(telegram.data?.botToken && telegram.data?.chatId);
  const submitTelegram = () => saveTelegram.mutate({ botToken: botToken.trim() || telegram.data?.botToken || "", chatId: chatId.trim(), alertThreshold: Number(alertThreshold), qualityAlertThreshold: Number(qualityThreshold), sendMode, enabled: telegramEnabled });
  const submitAi = () => saveAi.mutate({ mode: aiMode, model: aiModel.trim(), quotaAlertEnabled, quotaAlertThresholdPercent: Number(quotaAlertThreshold), ...(aiMode === "manual_api" ? { apiBaseUrl: apiBaseUrl.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) } : {}) });

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!user) return <div className="grid min-h-screen place-items-center bg-background p-6 text-center"><div><p className="text-sm text-muted-foreground">Đăng nhập để cài đặt Telegram và AI theo tài khoản.</p><Button className="mt-4" onClick={() => startLogin()}>Đăng nhập</Button></div></div>;
  return <main className="min-h-screen bg-background px-4 py-7 text-foreground md:px-8"><div className="mx-auto max-w-5xl"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><Button variant="ghost" size="sm" onClick={() => { window.location.href = "/?page=platform"; }}><ArrowLeft className="mr-1 h-4 w-4" /> Platform Overview</Button><p className="mt-5 text-xs font-semibold uppercase tracking-[.2em] text-primary">Account integrations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Cài đặt Telegram & AI</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Credential chỉ được gửi tới server khi lưu. Token/API key không được hiển thị lại đầy đủ, không nằm trong URL và không dùng để giao dịch.</p></div><Button variant="outline" onClick={() => { window.location.href = "/?page=command-center"; }}>Command Center</Button></header>
    <section className="mt-7 grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-primary" /> Telegram delivery</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="telegram-token">Bot Token</Label><Input id="telegram-token" type="password" autoComplete="new-password" value={botToken} onChange={event => setBotToken(event.target.value)} placeholder={telegram.data?.botToken ? "Đã lưu token đã che — để trống nếu không đổi" : "123456:ABC…"} className="mt-2" /><p className="mt-1 text-xs text-muted-foreground">Chỉ nhập khi tạo mới hoặc thay token. Giá trị đã lưu chỉ hiển thị dạng che.</p></div><div><Label htmlFor="telegram-chat">Chat ID</Label><Input id="telegram-chat" value={chatId} onChange={event => setChatId(event.target.value)} placeholder="-100123456789" className="mt-2" /></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-muted-foreground">Ngưỡng tín hiệu<Input className="mt-1" type="number" min={25} max={100} value={alertThreshold} onChange={event => setAlertThreshold(event.target.value)} /></label><label className="text-xs text-muted-foreground">Quality penalty<Input className="mt-1" type="number" min={5} max={80} value={qualityThreshold} onChange={event => setQualityThreshold(event.target.value)} /></label></div><label className="text-xs text-muted-foreground">Chế độ gửi<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={sendMode} onChange={event => setSendMode(event.target.value as "all_candles" | "strong_only")}><option value="all_candles">Gửi mọi nến</option><option value="strong_only">Chỉ tín hiệu mạnh</option></select></label><div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3"><div><p className="text-sm font-medium">Bật delivery Telegram</p><p className="mt-1 text-xs text-muted-foreground">Cảnh báo vẫn chỉ theo candle-close và guardrail hiện có.</p></div><Switch checked={telegramEnabled} onCheckedChange={setTelegramEnabled} /></div><div className="flex gap-2"><Button className="flex-1" onClick={submitTelegram} disabled={saveTelegram.isPending || !chatId.trim()}><Save className="mr-2 h-4 w-4" />{saveTelegram.isPending ? "Đang lưu…" : "Lưu Telegram"}</Button><Button variant="outline" onClick={() => testTelegram.mutate()} disabled={!configuredTelegram || testTelegram.isPending}>{testTelegram.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gửi test"}</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> AI technical analysis</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-2 inline h-4 w-4 text-primary" />Chế độ tự động chỉ chọn model hiện có trong catalog workspace. Catalog không công bố “miễn phí”, nên quota/chi phí luôn theo nhà cung cấp và workspace.</div><label className="text-xs text-muted-foreground">Chế độ model<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={aiMode} onChange={event => { setAiMode(event.target.value as AiMode); setQuotaStatus(null); }}><option value="workspace_auto">Tự động — model workspace khả dụng</option><option value="workspace_model">Chọn model workspace</option><option value="manual_api">Manual API — OpenAI-compatible</option></select></label>{aiMode !== "manual_api" ? <label className="text-xs text-muted-foreground">Model workspace<select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={aiMode === "workspace_auto" ? (autoModels[0]?.id ?? aiModel) : aiModel} disabled={aiMode === "workspace_auto"} onChange={event => setAiModel(event.target.value)}>{(aiMode === "workspace_auto" ? autoModels : workspaceModels).map(model => <option key={model.id} value={model.id}>{model.id}{model.autoEligible ? " · auto" : ""}</option>)}</select></label> : <><label className="text-xs text-muted-foreground">Model API<Input className="mt-1" value={aiModel} onChange={event => setAiModel(event.target.value)} placeholder="provider-model-id" /></label><label className="text-xs text-muted-foreground">HTTPS API endpoint<Input className="mt-1" value={apiBaseUrl} onChange={event => setApiBaseUrl(event.target.value)} placeholder="https://api.provider.example" /></label><label className="text-xs text-muted-foreground">API key<Input className="mt-1" type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={technicalAi.data?.settings.hasApiKey ? "Đã lưu key đã mã hóa — để trống nếu không đổi" : "Nhập API key"} /><span className="mt-1 block">Key được mã hóa trước khi lưu; endpoint phải là HTTPS public. Không hỗ trợ localhost/private IP.</span></label><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs text-muted-foreground">Cảnh báo quota khi còn lại (%)<Input className="mt-1" type="number" min={1} max={50} value={quotaAlertThreshold} onChange={event => setQuotaAlertThreshold(event.target.value)} /></label><div className="flex items-end"><div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"><Switch checked={quotaAlertEnabled} onCheckedChange={setQuotaAlertEnabled} /><span className="text-xs">Báo Telegram</span></div></div></div></>}<div className="flex gap-2"><Button className="flex-1" onClick={submitAi} disabled={saveAi.isPending || !aiModel.trim() || (aiMode === "manual_api" && (!apiBaseUrl.trim() || Number(quotaAlertThreshold) < 1 || Number(quotaAlertThreshold) > 50))}><KeyRound className="mr-2 h-4 w-4" />{saveAi.isPending ? "Đang lưu…" : "Lưu AI technical analysis"}</Button>{aiMode === "manual_api" && <Button variant="outline" onClick={() => testAiConnection.mutate()} disabled={testAiConnection.isPending || !technicalAi.data?.settings.hasApiKey}><CheckCircle2 className="mr-2 h-4 w-4" />{testAiConnection.isPending ? "Đang kiểm tra…" : "Kiểm tra & quota"}</Button>}</div>{aiMode === "manual_api" && <><p className="text-xs leading-5 text-muted-foreground">Heartbeat kiểm tra tối đa mỗi giờ và chỉ gửi Telegram khi provider công bố quota/rate-limit có giới hạn, trạng thái chuyển vào mức thấp, hoặc delivery trước đó thất bại. API key không được trả về hoặc hiển thị trong lỗi.</p>{quotaStatus && <div className={`rounded-xl border p-3 text-xs leading-5 ${quotaStatus.status === "unavailable" ? "border-border bg-muted/20 text-muted-foreground" : "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-200"}`}><p className="font-semibold">{quotaStatus.status === "quota" ? "Quota provider" : quotaStatus.status === "rate_limit" ? "Rate limit provider" : "Quota không khả dụng"}</p>{quotaStatus.status === "unavailable" ? <p className="mt-1">Provider không trả header quota/rate-limit trong phản hồi kiểm tra. App không ước tính quota còn lại.</p> : <p className="mt-1">Còn lại {quotaStatus.remaining ?? "—"}{quotaStatus.limit != null ? ` / ${quotaStatus.limit}` : ""} {quotaStatus.unit ?? ""}{quotaStatus.reset ? ` · reset ${quotaStatus.reset}` : ""}</p>}</div>}</>}<p className="text-xs leading-5 text-muted-foreground">Model/API đã chọn chỉ thay đổi phần tạo văn bản AI. Technical indicators, quality gate, Trade/No Trade và sandbox guardrails không đổi.</p></CardContent></Card></section>
    <Card className="mt-5 border-border"><CardContent className="flex gap-3 p-4 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /><span>API key được xử lý server-side; giao diện chỉ hiển thị trạng thái đã cấu hình. Khi dùng Manual API, endpoint phải tương thích OpenAI Chat Completions và token không được gửi về client sau khi lưu.</span></CardContent></Card>
  </div></main>;
}
