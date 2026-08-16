export type RiskHistoryPoint = {
  score: number;
  candleClosedAt: number;
};

export function formatRiskHistoryPoint(point: RiskHistoryPoint) {
  return {
    time: new Date(point.candleClosedAt).toLocaleString("vi-VN"),
    score: `${Math.round(point.score)}/100`,
  };
}

export function getRiskHistoryPointAriaLabel(point: RiskHistoryPoint) {
  const formatted = formatRiskHistoryPoint(point);
  return `Nến đóng ${formatted.time}, điểm rủi ro ${formatted.score}`;
}
