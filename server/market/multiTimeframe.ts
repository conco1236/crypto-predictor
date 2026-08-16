import type { IntervalName, MarketAnalysis } from "./binance";
import type { TrendLabel } from "./indicators";

export type SignalStatus = "Trade" | "No Trade";
export type TimeframeConfirmation = {
  status: SignalStatus;
  reason: string;
  alignedIntervals: IntervalName[];
  conflictingIntervals: IntervalName[];
};

const higherTimeframes: Record<IntervalName, IntervalName[]> = {
  "15m": ["1h", "4h"],
  "1h": ["4h", "1d"],
  "4h": ["1d"],
  "1d": [],
};

export function confirmTimeframeSignal(current: Pick<MarketAnalysis, "interval" | "indicators">, peers: Array<Pick<MarketAnalysis, "interval" | "indicators">>): TimeframeConfirmation {
  const label = current.indicators.label;
  const required = higherTimeframes[current.interval];
  if (label === "Neutral") return { status: "No Trade", reason: "Khung hiện tại là Neutral, chưa có xu hướng đủ rõ", alignedIntervals: [], conflictingIntervals: [] };
  if (Math.abs(current.indicators.score) < 25 || current.indicators.adx < 20) return { status: "No Trade", reason: "Điểm xu hướng hoặc ADX chưa đạt ngưỡng xác nhận", alignedIntervals: [], conflictingIntervals: [] };
  if (!required.length) return { status: Math.abs(current.indicators.score) >= 45 && current.indicators.adx >= 20 ? "Trade" : "No Trade", reason: Math.abs(current.indicators.score) >= 45 ? "Khung 1d đủ điểm và ADX xác nhận" : "Khung 1d cần điểm xu hướng tối thiểu 45", alignedIntervals: [], conflictingIntervals: [] };
  const alignedIntervals = required.filter(interval => peers.find(peer => peer.interval === interval)?.indicators.label === label && Math.abs(peers.find(peer => peer.interval === interval)!.indicators.score) >= 25);
  const conflictingIntervals = required.filter(interval => {
    const peer = peers.find(item => item.interval === interval);
    return Boolean(peer && peer.indicators.label !== label && peer.indicators.label !== "Neutral");
  });
  const missingIntervals = required.filter(interval => !peers.some(peer => peer.interval === interval));
  if (conflictingIntervals.length) return { status: "No Trade", reason: `Khung lớn xung đột: ${conflictingIntervals.join(", ")}`, alignedIntervals, conflictingIntervals };
  if (missingIntervals.length) return { status: "No Trade", reason: `Thiếu dữ liệu xác nhận: ${missingIntervals.join(", ")}`, alignedIntervals, conflictingIntervals };
  if (alignedIntervals.length !== required.length) return { status: "No Trade", reason: `Chưa đủ đồng thuận đa khung: cần ${required.join(" và ")}`, alignedIntervals, conflictingIntervals };
  return { status: "Trade", reason: `Đồng thuận ${label} trên ${[current.interval, ...alignedIntervals].join(", ")}`, alignedIntervals, conflictingIntervals };
}

export function applyTimeframeConfirmation(analyses: MarketAnalysis[]) {
  return analyses.map(analysis => {
    const peers = analyses.filter(peer => peer.exchange === analysis.exchange && peer.symbol === analysis.symbol);
    const confirmation = confirmTimeframeSignal(analysis, peers);
    return { ...analysis, signalStatus: confirmation.status, signalReason: confirmation.reason, timeframeConfirmation: confirmation };
  });
}

export type ConfirmedTrend = TrendLabel;
