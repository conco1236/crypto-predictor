import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveSocketManager } from "../client/src/lib/liveSockets";

class FakeSocket {
  static instances: FakeSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) { FakeSocket.instances.push(this); }
  send(message: string) { this.sent.push(message); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = FakeSocket.OPEN; this.onopen?.(); }
  message(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

afterEach(() => { vi.useRealTimers(); FakeSocket.instances = []; vi.unstubAllGlobals(); });

describe("LiveSocketManager", () => {
  it("normalizes Binance ticker and emits live snapshot", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    const manager = new LiveSocketManager();
    const snapshots: Array<Record<string, any>> = [];
    manager.subscribe((tickers) => snapshots.push(tickers));
    manager.start();
    const binance = FakeSocket.instances.find(socket => socket.url.includes("binance"))!;
    binance.open();
    binance.message({ data: { e: "24hrTicker", s: "BTCUSDT", c: "63100.5", P: "1.25", q: "123" } });
    vi.advanceTimersByTime(5_000);
    expect(snapshots.at(-1)?.["Binance:BTCUSDT"]).toMatchObject({ price: 63100.5, change24h: 1.25, volume24h: 123 });
    manager.stop();
  });

  it("normalizes Bybit and OKX ticker payloads", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    const manager = new LiveSocketManager();
    const snapshots: Array<Record<string, any>> = [];
    manager.subscribe((tickers) => snapshots.push(tickers));
    manager.start();
    const bybit = FakeSocket.instances.find(socket => socket.url.includes("bybit"))!;
    const okx = FakeSocket.instances.find(socket => socket.url.includes("okx"))!;
    bybit.open();
    okx.open();
    bybit.message({ topic: "tickers.BTCUSDT", ts: "100", data: { symbol: "BTCUSDT", lastPrice: "63000", price24hPcnt: "0.01", turnover24h: "200" } });
    okx.message({ arg: { channel: "tickers" }, data: [{ instId: "ETH-USDT", last: "3000", open24h: "2950", volCcy24h: "500" }] });
    vi.advanceTimersByTime(5_000);
    expect(snapshots.at(-1)?.["Bybit:BTCUSDT"]).toMatchObject({ price: 63000, change24h: 1, volume24h: 200 });
    expect(snapshots.at(-1)?.["OKX:ETHUSDT"]).toMatchObject({ price: 3000, volume24h: 500 });
    manager.stop();
  });

  it("reconnects with bounded backoff after disconnect", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    const manager = new LiveSocketManager();
    manager.start();
    const first = FakeSocket.instances.find(socket => socket.url.includes("binance"))!;
    first.open();
    first.close();
    vi.advanceTimersByTime(31_000);
    expect(FakeSocket.instances.filter(socket => socket.url.includes("binance"))).toHaveLength(2);
    manager.stop();
  });

  it("forces reconnect when a socket becomes stale", () => {
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", FakeSocket);
    const manager = new LiveSocketManager();
    const statuses: any[] = [];
    manager.subscribe((_tickers, status) => statuses.push(status));
    manager.start();
    const first = FakeSocket.instances.find(socket => socket.url.includes("binance"))!;
    first.open();
    vi.advanceTimersByTime(46_000);
    expect(FakeSocket.instances.filter(socket => socket.url.includes("binance")).length).toBeGreaterThan(1);
    expect(statuses.some(status => status.Binance === "reconnecting" || status.Binance === "error")).toBe(true);
    manager.stop();
  });
});
