export type ConfidenceTimelinePoint = { candleClosedAt: number; confidence: number; penalty: number | null; isTradeEligible: boolean | null; label: "Bullish" | "Bearish" | "Neutral" };

export function summarizeConfidenceTimeline(points: ConfidenceTimelinePoint[]) {
  if (!points.length) return { observations: 0, average: null, min: null, max: null, gated: 0 };
  const values = points.map(point => point.confidence);
  return { observations: points.length, average: values.reduce((sum, value) => sum + value, 0) / values.length, min: Math.min(...values), max: Math.max(...values), gated: points.filter(point => point.isTradeEligible === false).length };
}

export function formatConfidencePoint(point: ConfidenceTimelinePoint) {
  return { time: new Date(point.candleClosedAt).toLocaleString("vi-VN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }), confidence: Math.round(point.confidence), penalty: point.penalty == null ? "Không có" : `${Math.round(point.penalty)} điểm`, quality: point.isTradeEligible === false ? "Quality-gated" : point.isTradeEligible === true ? "Eligible" : "Chưa có metadata", trend: point.label };
}
