import { useEffect, useState } from "react";
import { liveSocketManager, LiveStatus, LiveTicker } from "@/lib/liveSockets";

export function useLivePrices() {
  const [tickers, setTickers] = useState<Record<string, LiveTicker>>({});
  const [status, setStatus] = useState<Record<"Binance" | "Bybit" | "OKX", LiveStatus>>({ Binance: "connecting", Bybit: "connecting", OKX: "connecting" });

  useEffect(() => {
    const unsubscribe = liveSocketManager.subscribe((nextTickers, nextStatus) => {
      setTickers(nextTickers);
      setStatus(nextStatus);
    });
    liveSocketManager.start();
    return () => { unsubscribe(); };
  }, []);

  return { tickers, status };
}
