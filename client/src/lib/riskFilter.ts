export type RiskFilter = "Tất cả" | "low" | "medium" | "high";

export function filterAnalyses<T extends { interval: string; exchange: string; risk?: { level?: string } }>(analyses: T[], interval: string, exchange: string, risk: RiskFilter) {
  return analyses.filter(item => item.interval === interval && (exchange === "Tất cả" || item.exchange === exchange) && (risk === "Tất cả" || item.risk?.level === risk));
}
