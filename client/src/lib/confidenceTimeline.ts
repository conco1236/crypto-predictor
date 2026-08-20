import { ABRUPT_CONFIDENCE_DROP_POINTS as sharedDropThreshold, annotateConfidenceMomentum, type ConfidenceMomentumPoint } from "@shared/confidenceMomentum";

export type ConfidenceTimelinePoint = ConfidenceMomentumPoint;
export type ConfidenceTimelineAlertPoint = ReturnType<typeof annotateConfidenceMomentum>[number];
export const ABRUPT_CONFIDENCE_DROP_POINTS = sharedDropThreshold;
export const annotateConfidenceDrops = annotateConfidenceMomentum;

export function summarizeConfidenceTimeline(points: ConfidenceTimelinePoint[], abruptThreshold = ABRUPT_CONFIDENCE_DROP_POINTS) {
  if (!points.length) return { observations: 0, average: null, min: null, max: null, gated: 0, abruptDrops: 0 };
  const values = points.map(point => point.confidence);
  return { observations: points.length, average: values.reduce((sum, value) => sum + value, 0) / values.length, min: Math.min(...values), max: Math.max(...values), gated: points.filter(point => point.isTradeEligible === false).length, abruptDrops: annotateConfidenceDrops(points, abruptThreshold).filter(point => point.isAbruptDrop).length };
}

export function formatConfidencePoint(point: ConfidenceTimelineAlertPoint) {
  return { time: new Date(point.candleClosedAt).toLocaleString("vi-VN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }), confidence: Math.round(point.confidence), penalty: point.penalty == null ? "Không có" : `${Math.round(point.penalty)} điểm`, quality: point.isTradeEligible === false ? "Quality-gated" : point.isTradeEligible === true ? "Eligible" : "Chưa có metadata", trend: point.label, delta: point.confidenceDelta == null ? "—" : `${point.confidenceDelta > 0 ? "+" : ""}${point.confidenceDelta.toFixed(1)} điểm`, alert: point.isAbruptDrop ? `Giảm đột ngột −${point.dropMagnitude.toFixed(1)} điểm` : "Không" };
}
