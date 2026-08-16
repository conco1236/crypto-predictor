export type LiveExchange = "Binance" | "Bybit" | "OKX";
export type LiveSymbol = "BTCUSDT" | "ETHUSDT";
export type LiveStatus = "connecting" | "connected" | "reconnecting" | "error" | "closed";

export type LiveTicker = {
  exchange: LiveExchange;
  symbol: LiveSymbol;
  price: number;
  change24h: number;
  volume24h?: number;
  eventTime: number;
  receivedAt: number;
};

type Listener = (tickers: Record<string, LiveTicker>, status: Record<LiveExchange, LiveStatus>) => void;
const symbols: LiveSymbol[] = ["BTCUSDT", "ETHUSDT"];
const key = (exchange: LiveExchange, symbol: LiveSymbol) => `${exchange}:${symbol}`;
const emptyStatus = (): Record<LiveExchange, LiveStatus> => ({ Binance: "connecting", Bybit: "connecting", OKX: "connecting" });
const num = (value: unknown) => Number(value ?? 0);

export class LiveSocketManager {
  private sockets = new Map<LiveExchange, WebSocket>();
  private reconnectTimers = new Map<LiveExchange, ReturnType<typeof setTimeout>>();
  private heartbeatTimers = new Map<LiveExchange, ReturnType<typeof setTimeout>>();
  private watchdogTimers = new Map<LiveExchange, ReturnType<typeof setTimeout>>();
  private lastMessageAt = new Map<LiveExchange, number>();
  private attempts = new Map<LiveExchange, number>();
  private tickers: Record<string, LiveTicker> = {};
  private statuses = emptyStatus();
  private listeners = new Set<Listener>();
  private emitTimer?: ReturnType<typeof setTimeout>;
  private stopped = true;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.tickers, this.statuses);
    return () => this.listeners.delete(listener);
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    (["Binance", "Bybit", "OKX"] as LiveExchange[]).forEach(exchange => this.connect(exchange));
    this.scheduleEmit();
  }

  stop() {
    this.stopped = true;
    this.reconnectTimers.forEach(timer => clearTimeout(timer));
    this.heartbeatTimers.forEach(timer => clearTimeout(timer));
    this.watchdogTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.clear();
    this.heartbeatTimers.clear();
    this.watchdogTimers.clear();
    this.sockets.forEach(socket => socket.close(1000, "component unmounted"));
    this.sockets.clear();
    this.statuses = { Binance: "closed", Bybit: "closed", OKX: "closed" };
  }

  private connect(exchange: LiveExchange) {
    if (this.stopped) return;
    this.statuses[exchange] = this.attempts.get(exchange) ? "reconnecting" : "connecting";
    const socket = new WebSocket(this.url(exchange));
    this.sockets.set(exchange, socket);
    socket.onopen = () => {
      this.attempts.set(exchange, 0);
      this.statuses[exchange] = "connected";
      this.lastMessageAt.set(exchange, Date.now());
      this.scheduleWatchdog(exchange);
      if (exchange === "Bybit" || exchange === "OKX") this.sendSubscription(exchange, socket);
      this.scheduleHeartbeat(exchange);
      this.scheduleEmit(true);
    };
    socket.onmessage = event => this.handleMessage(exchange, socket, event.data);
    socket.onerror = () => { this.statuses[exchange] = "error"; this.scheduleEmit(true); };
    socket.onclose = () => {
      if (this.sockets.get(exchange) === socket) this.sockets.delete(exchange);
      if (!this.stopped) this.scheduleReconnect(exchange);
    };
  }

  private url(exchange: LiveExchange) {
    if (exchange === "Binance") return "wss://stream.binance.com:9443/stream?streams=btcusdt@ticker/ethusdt@ticker";
    if (exchange === "Bybit") return "wss://stream.bybit.com/v5/public/spot";
    return "wss://ws.okx.com:8443/ws/v5/public";
  }

  private sendSubscription(exchange: LiveExchange, socket: WebSocket) {
    if (exchange === "Bybit") socket.send(JSON.stringify({ op: "subscribe", args: symbols.map(symbol => `tickers.${symbol}`) }));
    if (exchange === "OKX") socket.send(JSON.stringify({ op: "subscribe", args: symbols.map(symbol => ({ channel: "tickers", instId: symbol === "BTCUSDT" ? "BTC-USDT" : "ETH-USDT" })) }));
  }

  private handleMessage(exchange: LiveExchange, socket: WebSocket, raw: string) {
    this.lastMessageAt.set(exchange, Date.now());
    try {
      if (exchange === "Bybit" && raw === "pong") return;
      if (exchange === "OKX" && raw === "pong") return;
      const message = JSON.parse(raw);
      if (exchange === "Binance" && message.data?.e === "24hrTicker") {
        const data = message.data;
        this.save({ exchange, symbol: data.s, price: num(data.c), change24h: num(data.P), volume24h: num(data.q), eventTime: num(data.E) });
      } else if (exchange === "Bybit" && message.topic?.startsWith("tickers.") && message.data) {
        const data = message.data;
        this.save({ exchange, symbol: data.symbol, price: num(data.lastPrice), change24h: num(data.price24hPcnt) * 100, volume24h: num(data.turnover24h), eventTime: num(message.ts) });
      } else if (exchange === "OKX" && message.arg?.channel === "tickers" && message.data?.[0]) {
        const data = message.data[0];
        this.save({ exchange, symbol: data.instId === "BTC-USDT" ? "BTCUSDT" : "ETHUSDT", price: num(data.last), change24h: data.open24h ? (num(data.last) / num(data.open24h) - 1) * 100 : 0, volume24h: num(data.volCcy24h), eventTime: num(data.ts) });
      }
    } catch { /* ignore malformed provider frames and keep the socket alive */ }
    void socket;
  }

  private save(input: Omit<LiveTicker, "receivedAt">) {
    if (!symbols.includes(input.symbol)) return;
    this.tickers[key(input.exchange, input.symbol)] = { ...input, receivedAt: Date.now() };
    this.scheduleEmit();
  }

  private scheduleEmit(immediate = false) {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined;
      this.listeners.forEach(listener => listener({ ...this.tickers }, { ...this.statuses }));
      if (!immediate && !this.stopped) this.scheduleEmit();
    }, immediate ? 0 : 5000);
  }

  private scheduleWatchdog(exchange: LiveExchange) {
    const previous = this.watchdogTimers.get(exchange);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      const socket = this.sockets.get(exchange);
      const staleFor = Date.now() - (this.lastMessageAt.get(exchange) ?? 0);
      if (socket?.readyState === WebSocket.OPEN && staleFor > 35_000) {
        this.statuses[exchange] = "error";
        socket.close(4000, "stale market feed");
        this.scheduleEmit(true);
        return;
      }
      if (!this.stopped) this.scheduleWatchdog(exchange);
    }, 10_000);
    this.watchdogTimers.set(exchange, timer);
  }

  private scheduleHeartbeat(exchange: LiveExchange) {
    const previous = this.heartbeatTimers.get(exchange);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      const socket = this.sockets.get(exchange);
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(exchange === "OKX" ? "ping" : JSON.stringify({ op: "ping" }));
        this.scheduleHeartbeat(exchange);
      }
    }, 20_000);
    this.heartbeatTimers.set(exchange, timer);
  }

  private scheduleReconnect(exchange: LiveExchange) {
    if (this.stopped || this.reconnectTimers.has(exchange)) return;
    const attempt = (this.attempts.get(exchange) ?? 0) + 1;
    this.attempts.set(exchange, attempt);
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempt - 1, 5)) + Math.floor(Math.random() * 500);
    this.statuses[exchange] = "reconnecting";
    this.scheduleEmit(true);
    const timer = setTimeout(() => { this.reconnectTimers.delete(exchange); this.connect(exchange); }, delay);
    this.reconnectTimers.set(exchange, timer);
  }
}

export const liveSocketManager = new LiveSocketManager();
