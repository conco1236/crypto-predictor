import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CandlestickChart,
  CheckCircle2,
  CircleDot,
  Clock3,
  Database,
  Gauge,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import {
  coinName,
  formatIndicator,
  formatPrice,
  SYMBOLS,
  TIMEFRAMES,
  type MarketSymbol,
  type SignalSnapshot,
  type SignalStatus,
  type Timeframe,
} from "@/lib/signal";

const statusStyles: Record<SignalStatus, { label: string; className: string; icon: typeof ArrowUpRight }> = {
  Bullish: { label: "Bullish", className: "signal-bullish", icon: ArrowUpRight },
  Bearish: { label: "Bearish", className: "signal-bearish", icon: ArrowDownRight },
  Neutral: { label: "Neutral", className: "signal-neutral", icon: CircleDot },
  "No Trade": { label: "No Trade", className: "signal-no-trade", icon: ShieldAlert },
};

function statusCopy(status: SignalStatus) {
  if (status === "Bullish") return "Trend continuation setup";
  if (status === "Bearish") return "Downtrend continuation setup";
  if (status === "Neutral") return "Wait for confirmation";
  return "Risk filter active";
}

function toLocalTime(value: number) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function SignalBadge({ status }: { status: SignalStatus }) {
  const style = statusStyles[status];
  const Icon = style.icon;
  return (
    <span className={`signal-badge ${style.className}`}>
      <Icon className="h-3.5 w-3.5" /> {style.label}
    </span>
  );
}

function Metric({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`metric-cell ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CoinRail({ selected, onSelect, signals }: { selected: MarketSymbol; onSelect: (symbol: MarketSymbol) => void; signals: SignalSnapshot[] }) {
  return (
    <div className="coin-rail" aria-label="Select asset">
      {SYMBOLS.map(symbol => {
        const oneHour = signals.find(signal => signal.symbol === symbol && signal.timeframe === "1h");
        const status = oneHour?.status ?? "No Trade";
        return (
          <button
            type="button"
            key={symbol}
            onClick={() => onSelect(symbol)}
            className={`coin-rail-item ${selected === symbol ? "is-active" : ""}`}
            aria-pressed={selected === symbol}
          >
            <span className={`coin-glyph ${symbol === "BTCUSDT" ? "coin-bitcoin" : "coin-ethereum"}`}>{coinName(symbol).slice(0, 1)}</span>
            <span className="min-w-0 text-left">
              <strong>{coinName(symbol)}</strong>
              <small>{formatPrice(oneHour?.currentPrice ?? null, true)} USDT</small>
            </span>
            <span className={`rail-status ${statusStyles[status].className}`} aria-label={status} />
          </button>
        );
      })}
    </div>
  );
}

function TimeframeTabs({ active, onSelect, signals }: { active: Timeframe; onSelect: (timeframe: Timeframe) => void; signals: SignalSnapshot[] }) {
  return (
    <div className="timeframe-tabs" role="tablist" aria-label="Signal timeframe">
      {TIMEFRAMES.map(timeframe => {
        const signal = signals.find(item => item.timeframe === timeframe);
        return (
          <button
            type="button"
            key={timeframe}
            role="tab"
            aria-selected={active === timeframe}
            onClick={() => onSelect(timeframe)}
            className={`timeframe-tab ${active === timeframe ? "is-active" : ""}`}
          >
            <span>{timeframe}</span>
            <i className={signal ? statusStyles[signal.status].className : "signal-no-trade"} />
          </button>
        );
      })}
    </div>
  );
}

function SignalDetail({ signal, historyCount }: { signal: SignalSnapshot; historyCount: number }) {
  const status = statusStyles[signal.status];
  const DirectionIcon = status.icon;
  const stale = signal.freshness.stale;
  const isActionable = signal.plan.direction !== null;
  const riskWidth = signal.riskScore === "Low" ? 32 : signal.riskScore === "Medium" ? 62 : 91;

  return (
    <div className="signal-detail" role="tabpanel">
      <section className="signal-hero-card">
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="relative z-10 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow"><Activity className="h-3.5 w-3.5" /> Active technical read</div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <SignalBadge status={signal.status} />
              <span className="text-sm text-[#9aa5bd]">{statusCopy(signal.status)}</span>
            </div>
          </div>
          <div className={`trend-icon ${status.className}`}><DirectionIcon className="h-5 w-5" /></div>
        </div>
        <div className="relative z-10 mt-9 grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-end">
          <div>
            <p className="label-overline">Closed-candle price</p>
            <p className="hero-price">{formatPrice(signal.currentPrice)} <span>USDT</span></p>
          </div>
          <div className="hero-readout">
            <span>Confluence</span>
            <strong>{signal.confluenceScore}<small>%</small></strong>
            <div className="confluence-track"><i style={{ width: `${signal.confluenceScore}%` }} /></div>
          </div>
        </div>
      </section>

      <div className="detail-grid">
        <section className="dashboard-card plan-card">
          <div className="card-heading">
            <div><span className="section-kicker">Trade map</span><h2>{isActionable ? `${signal.plan.direction} opportunity` : "No trade map"}</h2></div>
            <Target className="h-5 w-5 text-[#7f8faa]" />
          </div>
          <div className="trade-plan-grid">
            <Metric label="Entry zone" value={`${formatPrice(signal.plan.entryLow)} – ${formatPrice(signal.plan.entryHigh)}`} />
            <Metric label="Take Profit" value={formatPrice(signal.plan.takeProfit)} className="take-profit" />
            <Metric label="Stop Loss" value={formatPrice(signal.plan.stopLoss)} className="stop-loss" />
          </div>
          <p className="explanation"><Sparkles className="h-4 w-4" /> {signal.reasons[0] ?? "Awaiting a fully closed candle for a technical read."}</p>
        </section>

        <section className="dashboard-card risk-card">
          <div className="card-heading">
            <div><span className="section-kicker">Risk signal</span><h2>{signal.riskScore}</h2></div>
            <Gauge className="h-5 w-5 text-[#7f8faa]" />
          </div>
          <div className="risk-meter" aria-label={`${signal.riskScore} risk`}><i style={{ width: `${riskWidth}%` }} /></div>
          <p>Calculated from ADX strength, RSI extremes, volume confirmation, and cross-timeframe agreement.</p>
          <div className="risk-foot"><span>ADX {formatIndicator(signal.indicators.adx14, 1)}</span><span>Vol. {formatIndicator(signal.indicators.volumeRatio, 2)}×</span></div>
        </section>
      </div>

      <section className="dashboard-card indicators-card">
        <div className="card-heading">
          <div><span className="section-kicker">Technical matrix</span><h2>Indicator context</h2></div>
          <CandlestickChart className="h-5 w-5 text-[#7f8faa]" />
        </div>
        <div className="indicators-grid">
          <Metric label="EMA 9" value={formatPrice(signal.indicators.ema9)} />
          <Metric label="EMA 21" value={formatPrice(signal.indicators.ema21)} />
          <Metric label="EMA 50" value={formatPrice(signal.indicators.ema50)} />
          <Metric label="EMA 200" value={formatPrice(signal.indicators.ema200)} />
          <Metric label="RSI 14" value={formatIndicator(signal.indicators.rsi14, 1)} />
          <Metric label="MACD hist." value={formatIndicator(signal.indicators.macdHistogram, 2)} />
          <Metric label="Bollinger upper" value={formatPrice(signal.indicators.bollingerUpper)} />
          <Metric label="Bollinger lower" value={formatPrice(signal.indicators.bollingerLower)} />
          <Metric label="Support" value={formatPrice(signal.indicators.support)} />
          <Metric label="Resistance" value={formatPrice(signal.indicators.resistance)} />
        </div>
      </section>

      <section className={`freshness-card ${stale ? "is-stale" : ""}`}>
        {stale ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        <div><strong>{stale ? "Stale feed warning" : "Fresh closed-candle data"}</strong><span>Expected next {signal.timeframe} candle close: {toLocalTime(signal.freshness.expectedNextCandleCloseTime)} · {historyCount} recent snapshots available</span></div>
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="dashboard-shell animate-pulse" aria-label="Loading market signals">
      <div className="h-24 rounded-[1.75rem] bg-white/5" />
      <div className="mt-5 grid gap-4 md:grid-cols-[230px_1fr]"><div className="h-40 rounded-[1.5rem] bg-white/5" /><div className="h-96 rounded-[1.5rem] bg-white/5" /></div>
    </div>
  );
}

export default function SignalDashboard() {
  const [symbol, setSymbol] = useState<MarketSymbol>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("1h");
  const signalQuery = trpc.signals.latest.useQuery(undefined, { refetchInterval: 60_000, staleTime: 20_000, retry: 1 });
  const historyQuery = trpc.signals.history.useQuery({ symbol, timeframe, limit: 8 }, { refetchInterval: 60_000, staleTime: 20_000 });
  const healthQuery = trpc.signals.health.useQuery(undefined, { refetchInterval: 60_000, staleTime: 20_000 });
  const telegramStatus = trpc.telegram.status.useQuery(undefined, { staleTime: 30_000 });
  const minuteRefresh = trpc.automation.enableMinuteRefresh.useMutation();
  const webhookSetup = trpc.telegram.configureWebhook.useMutation();
  const { user, loading: authLoading } = useAuth();
  const signals = useMemo(() => (signalQuery.data?.signals ?? []) as SignalSnapshot[], [signalQuery.data]);
  const selectedSignals = signals.filter(signal => signal.symbol === symbol);
  const selected = selectedSignals.find(signal => signal.timeframe === timeframe);
  const observedAt = selected?.freshness.observedAt;

  if (signalQuery.isLoading) return <DashboardSkeleton />;
  if (signalQuery.error || !selected) {
    return (
      <div className="error-shell">
        <ShieldAlert className="h-7 w-7 text-rose-300" />
        <h1>Market feed is unavailable</h1>
        <p>The dashboard could not obtain a closed-candle technical signal. Please retry after confirming the public Binance feed is reachable.</p>
        <button type="button" onClick={() => void signalQuery.refetch()} className="primary-action"><RefreshCw className="h-4 w-4" /> Try again</button>
      </div>
    );
  }

  const refreshView = async () => {
    const result = await signalQuery.refetch();
    if (result.error) toast.error("Unable to refresh the signal view.");
    else toast.success("Signal view refreshed from the latest stored or live analysis.");
  };

  const enableMinuteRefresh = async () => {
    try {
      const result = await minuteRefresh.mutateAsync();
      await healthQuery.refetch();
      toast.success(result.existing ? "One-minute refresh is already active." : "One-minute refresh is now scheduled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to enable the scheduled refresh.");
    }
  };

  const activateWebhook = async () => {
    try {
      await webhookSetup.mutateAsync();
      await telegramStatus.refetch();
      toast.success("Telegram webhook activated for /btc and /eth.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to activate the Telegram webhook.");
    }
  };

  return (
    <div className="dashboard-shell">
      <header className="app-topbar">
        <div className="brand-lockup"><div className="brand-mark"><Activity className="h-5 w-5" /></div><div><span>ORBITAL</span><strong>Signal Desk</strong></div></div>
        <div className="topbar-actions">
          <div className="live-pill"><i /><span>{healthQuery.data?.lastSuccessAt ? "Synced" : "Live read"}</span></div>
          <button type="button" className="icon-action" onClick={() => void refreshView()} aria-label="Refresh signal view"><RefreshCw className={signalQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></button>
        </div>
      </header>

      <main className="app-main">
        <section className="intro-row">
          <div><p className="eyebrow"><Bot className="h-3.5 w-3.5" /> Telegram technical signals</p><h1>Precision over noise.</h1><p>BTC/USDT and ETH/USDT technical context derived exclusively from closed candles.</p></div>
          <div className="observation"><Clock3 className="h-4 w-4" /><span>{observedAt ? `Last observation ${toLocalTime(observedAt)}` : "Waiting for observation"}</span><small>{signalQuery.data?.source === "database" ? "Stored signal state" : "Live calculation"}</small></div>
        </section>

        <div className="workspace-grid">
          <aside><CoinRail selected={symbol} onSelect={setSymbol} signals={signals} /><div className="sidebar-note"><Database className="h-4 w-4" /><span>Closed candles only. Alerts are never based on a forming bar.</span></div></aside>
          <div className="workspace-panel">
            <div className="asset-head">
              <div><p className="label-overline">Selected market</p><h2>{coinName(symbol)}<span>/USDT</span></h2></div>
              <div className="asset-price"><span>Last close</span><strong>{formatPrice(selected.currentPrice)}</strong></div>
            </div>
            <TimeframeTabs active={timeframe} onSelect={setTimeframe} signals={selectedSignals} />
            <SignalDetail signal={selected} historyCount={historyQuery.data?.length ?? 0} />
            <section className="operations-grid" aria-label="Automation controls">
              <article className="operation-card">
                <div className="operation-icon"><Zap className="h-4 w-4" /></div>
                <div className="operation-copy"><span>Market engine</span><strong>{healthQuery.data?.scheduleCronTaskUid ? "One-minute refresh active" : "Ready for one-minute refresh"}</strong><small>Processes closed candles only and persists an idempotent signal history.</small></div>
                {user?.role === "admin" ? <button type="button" className="control-button" disabled={Boolean(healthQuery.data?.scheduleCronTaskUid) || minuteRefresh.isPending} onClick={() => void enableMinuteRefresh()}>{minuteRefresh.isPending ? "Scheduling…" : healthQuery.data?.scheduleCronTaskUid ? "Active" : "Enable"}</button> : <button type="button" className="control-button" disabled={authLoading} onClick={() => startLogin()}>{authLoading ? "Loading…" : "Admin sign in"}</button>}
              </article>
              <article className="operation-card">
                <div className="operation-icon telegram-icon"><Bot className="h-4 w-4" /></div>
                <div className="operation-copy"><span>Telegram bot</span><strong>{telegramStatus.data?.configured ? "Bot credentials configured" : "Awaiting secure bot credentials"}</strong><small>Handles exact <b>/btc</b> and <b>/eth</b> commands through an authenticated webhook.</small></div>
                {user?.role === "admin" ? <button type="button" className="control-button" disabled={!telegramStatus.data?.configured || telegramStatus.data?.deploymentRequired || webhookSetup.isPending} onClick={() => void activateWebhook()}>{webhookSetup.isPending ? "Connecting…" : telegramStatus.data?.deploymentRequired ? "Publish first" : telegramStatus.data?.configured ? "Activate" : "Configure"}</button> : <span className="control-state">{telegramStatus.data?.configured ? "Ready" : "Pending"}</span>}
              </article>
            </section>
            <section className="monitor-grid" aria-label="Signal history and refresh health">
              <article className="monitor-card">
                <div className="monitor-heading"><div><span>Refresh health</span><strong>Data engine status</strong></div><Activity className="h-4 w-4" /></div>
                {healthQuery.isLoading ? <p className="monitor-empty">Checking refresh health…</p> : healthQuery.error ? <p className="monitor-empty is-error">Refresh health is currently unavailable.</p> : healthQuery.data ? <div className="health-lines"><p><span>Last run</span><b>{healthQuery.data.lastRunAt ? new Date(healthQuery.data.lastRunAt).toLocaleString() : "Not scheduled"}</b></p><p><span>Last successful</span><b>{healthQuery.data.lastSuccessAt ? new Date(healthQuery.data.lastSuccessAt).toLocaleString() : "No successful run"}</b></p><p><span>Updated signals</span><b>{healthQuery.data.refreshedSignals}</b></p>{healthQuery.data.lastError ? <p className="health-error">{healthQuery.data.lastError}</p> : null}</div> : <p className="monitor-empty">Heartbeat will report status after its first published run.</p>}
              </article>
              <article className="monitor-card">
                <div className="monitor-heading"><div><span>Closed-candle history</span><strong>{coinName(symbol)} · {timeframe}</strong></div><Clock3 className="h-4 w-4" /></div>
                {historyQuery.isLoading ? <p className="monitor-empty">Loading recorded signals…</p> : historyQuery.error ? <p className="monitor-empty is-error">Signal history is currently unavailable.</p> : historyQuery.data?.length ? <div className="history-list">{historyQuery.data.slice(0, 4).map(row => <div className="history-row" key={row.id}><span>{new Date(Number(row.candleCloseTime)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><SignalBadge status={row.status as SignalStatus} /><b>{row.riskScore}</b></div>)}</div> : <p className="monitor-empty">No closed-candle history has been recorded for this view yet.</p>}
              </article>
            </section>
          </div>
        </div>
      </main>
      <footer className="app-footer">Technical market analysis only. Signal levels are informational and do not execute trades.</footer>
    </div>
  );
}
