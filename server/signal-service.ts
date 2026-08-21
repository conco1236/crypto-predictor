import * as db from "./db";
import { fetchAndAnalyzeMarket } from "./market-data";
import type { SignalSnapshot } from "./signal-engine";

export function uniqueClosedCandleSignals(signals: SignalSnapshot[]): SignalSnapshot[] {
  return Array.from(new Map(signals.map(signal => [
    `${signal.symbol}:${signal.timeframe}:${signal.candleOpenTime}`,
    signal,
  ])).values());
}

export async function refreshMarketSignals(observedAt = Date.now()): Promise<SignalSnapshot[]> {
  await db.markMarketRefresh({ status: "started" });
  try {
    const signals = uniqueClosedCandleSignals(await fetchAndAnalyzeMarket(observedAt));
    await db.persistSignalSnapshots(signals);
    await db.markMarketRefresh({ status: "success", count: signals.length });
    return signals;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.markMarketRefresh({ status: "failed", error: message });
    throw error;
  }
}
