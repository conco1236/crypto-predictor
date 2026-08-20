export type QualityThresholdOverride = { exchange: string; threshold: number };
export type QualitySnapshot = { exchange: string; indicators: string };

export function resolveQualityThreshold(exchange: string, globalThreshold: number, overrides: QualityThresholdOverride[]) {
  return overrides.find(item => item.exchange === exchange)?.threshold ?? globalThreshold;
}

export function buildQualityAlertPreview(rows: QualitySnapshot[], globalThreshold: number, overrides: QualityThresholdOverride[]) {
  const known = rows.flatMap(row => {
    try {
      const penalty = Number((JSON.parse(row.indicators) as { signalQuality?: { penalty?: number } }).signalQuality?.penalty);
      return Number.isFinite(penalty) ? [{ exchange: row.exchange, penalty }] : [];
    } catch { return []; }
  });
  const exchanges = ["Binance", "Bybit", "OKX"];
  const byExchange = exchanges.map(exchange => {
    const snapshots = known.filter(item => item.exchange === exchange);
    const threshold = resolveQualityThreshold(exchange, globalThreshold, overrides);
    return { exchange, threshold, observations: snapshots.length, projectedAlerts: snapshots.filter(item => item.penalty >= threshold).length };
  });
  return { observations: known.length, projectedAlerts: byExchange.reduce((sum, item) => sum + item.projectedAlerts, 0), byExchange, note: known.length ? "Preview chỉ đếm snapshot có quality penalty đã lưu; không dự báo alert tương lai." : "Chưa có snapshot quality penalty đã lưu để preview." };
}
