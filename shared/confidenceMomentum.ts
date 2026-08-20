export type ConfidenceMomentumPoint = { candleClosedAt: number; confidence: number; penalty: number | null; isTradeEligible: boolean | null; label: "Bullish" | "Bearish" | "Neutral" };
export type ConfidenceMomentumStatus = "critical" | "deteriorating" | "recovering" | "stable" | "insufficient";
export const ABRUPT_CONFIDENCE_DROP_POINTS = 15;
export const DETERIORATING_CONFIDENCE_DROP_POINTS = 8;
export type MomentumThresholds = { criticalDropThreshold: number; deterioratingDropThreshold: number };
export const DEFAULT_MOMENTUM_THRESHOLDS: MomentumThresholds = { criticalDropThreshold: ABRUPT_CONFIDENCE_DROP_POINTS, deterioratingDropThreshold: DETERIORATING_CONFIDENCE_DROP_POINTS };

export function normalizeMomentumThresholds(thresholds?: Partial<MomentumThresholds>): MomentumThresholds {
  const deterioratingDropThreshold = Math.min(30, Math.max(3, Math.round(thresholds?.deterioratingDropThreshold ?? DETERIORATING_CONFIDENCE_DROP_POINTS)));
  const criticalDropThreshold = Math.min(50, Math.max(deterioratingDropThreshold + 1, Math.round(thresholds?.criticalDropThreshold ?? ABRUPT_CONFIDENCE_DROP_POINTS)));
  return { criticalDropThreshold, deterioratingDropThreshold };
}

export function annotateConfidenceMomentum(points: ConfidenceMomentumPoint[], abruptThreshold = ABRUPT_CONFIDENCE_DROP_POINTS) {
  const threshold = Math.max(1, abruptThreshold);
  return points.map((point, index) => {
    const previous = points[index - 1];
    const confidenceDelta = previous ? Math.round((point.confidence - previous.confidence) * 10) / 10 : null;
    const dropMagnitude = confidenceDelta != null && confidenceDelta < 0 ? Math.abs(confidenceDelta) : 0;
    return { ...point, confidenceDelta, dropMagnitude, isAbruptDrop: dropMagnitude >= threshold };
  });
}

export function classifyConfidenceMomentum(points: ConfidenceMomentumPoint[], thresholds?: Partial<MomentumThresholds>) {
  const resolvedThresholds = normalizeMomentumThresholds(thresholds);
  const annotated = annotateConfidenceMomentum(points, resolvedThresholds.criticalDropThreshold);
  const latest = annotated.at(-1);
  if (!latest) return { status: "insufficient" as const, latest: null, recentDelta: null, twoCandleDelta: null, reason: "Chưa có snapshot confidence." };
  if (annotated.length < 2) return { status: "insufficient" as const, latest, recentDelta: null, twoCandleDelta: null, reason: "Cần thêm ít nhất một nến đóng để so sánh confidence." };
  const recentDelta = latest.confidenceDelta ?? 0;
  const twoCandleDelta = annotated.length >= 3 ? Math.round((latest.confidence - annotated.at(-3)!.confidence) * 10) / 10 : null;
  if (latest.isAbruptDrop) return { status: "critical" as const, latest, recentDelta, twoCandleDelta, reason: `Confidence giảm đột ngột ${latest.dropMagnitude.toFixed(1)} điểm so với nến trước.` };
  if (latest.isTradeEligible === false) return { status: "critical" as const, latest, recentDelta, twoCandleDelta, reason: "Quality gate của snapshot mới nhất không cho phép nâng trạng thái Trade." };
  if (recentDelta <= -resolvedThresholds.deterioratingDropThreshold || (twoCandleDelta != null && twoCandleDelta <= -resolvedThresholds.deterioratingDropThreshold)) return { status: "deteriorating" as const, latest, recentDelta, twoCandleDelta, reason: `Confidence đang suy giảm (${recentDelta.toFixed(1)} điểm ở nến gần nhất).` };
  if (recentDelta >= resolvedThresholds.deterioratingDropThreshold && latest.isTradeEligible === true) return { status: "recovering" as const, latest, recentDelta, twoCandleDelta, reason: `Confidence phục hồi ${recentDelta.toFixed(1)} điểm so với nến trước.` };
  return { status: "stable" as const, latest, recentDelta, twoCandleDelta, reason: "Confidence chưa có biến động đủ lớn để tạo early-warning." };
}
