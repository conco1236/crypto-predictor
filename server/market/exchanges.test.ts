import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExchangeCandles, intervalToMs, isCandleClosed } from "./binance";

const candle = (openTime: number, base: number) => [String(openTime), String(base), String(base + 2), String(base - 1), String(base + 1), "10"];

function response(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

afterEach(() => vi.unstubAllGlobals());

describe("multi-exchange market adapters", () => {
  it("detects only fully closed candles", () => {
    const openTime = 1_000_000;
    expect(intervalToMs("15m")).toBe(900_000);
    expect(isCandleClosed(openTime, "15m", openTime + 899_999)).toBe(false);
    expect(isCandleClosed(openTime, "15m", openTime + 900_000)).toBe(true);
  });
  it("retries a transient provider error before failing", async () => {
    const rows = Array.from({ length: 50 }, (_, index) => candle(index + 1, 100 + index));
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("temporary network error")).mockResolvedValueOnce(response(rows));
    vi.stubGlobal("fetch", fetchMock);
    const candles = await fetchExchangeCandles("Binance", "BTCUSDT", "15m", 50);
    expect(candles).toHaveLength(50);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["Binance", "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=50"],
    ["Bybit", "https://api.bybit.com/v5/market/kline?category=spot&symbol=BTCUSDT&interval=15&limit=50"],
    ["OKX", "https://www.okx.com/api/v5/market/candles?instId=BTC-USDT&bar=15m&limit=50"],
  ] as const)("normalizes %s candles", async (exchange, expectedPrefix) => {
    const rows = Array.from({ length: 50 }, (_, index) => candle(index + 1, 100 + index));
    const body = exchange === "Binance" ? rows : exchange === "Bybit" ? { retCode: 0, result: { list: rows.slice().reverse() } } : { code: "0", data: rows.slice().reverse() };
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain(expectedPrefix);
      return response(body);
    });
    vi.stubGlobal("fetch", fetchMock);

    const candles = await fetchExchangeCandles(exchange, "BTCUSDT", "15m", 50);
    expect(candles).toHaveLength(50);
    expect(candles[0]).toMatchObject({ openTime: 1, open: 100, high: 102, low: 99, close: 101, volume: 10 });
    expect(candles.at(-1)?.openTime).toBe(50);
  });
});
