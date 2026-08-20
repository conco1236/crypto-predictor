import { summarizeOutcomes, type SignalOutcome } from "./outcomes";

export type QualityOutcomeRow = {
  exchange: string;
  symbol: string;
  interval: string;
  outcome: SignalOutcome;
  quality?: { penalty?: number; isTradeEligible?: boolean };
};

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function summarizeQualityBacktest(rows: QualityOutcomeRow[]) {
  const known = rows.filter(row => Number.isFinite(row.quality?.penalty));
  const byAssetTimeframe: Record<string, { observations: number; eligible: number; gated: number; averagePenalty: number; eligibleOutcomes: ReturnType<typeof summarizeOutcomes>; gatedOutcomes: ReturnType<typeof summarizeOutcomes> }> = {};
  for (const row of known) {
    const key = `${row.symbol}:${row.interval}`;
    const bucket = known.filter(item => `${item.symbol}:${item.interval}` === key);
    const eligibleRows = bucket.filter(item => item.quality?.isTradeEligible);
    const gatedRows = bucket.filter(item => !item.quality?.isTradeEligible);
    byAssetTimeframe[key] = {
      observations: bucket.length,
      eligible: eligibleRows.length,
      gated: gatedRows.length,
      averagePenalty: Number(average(bucket.map(item => Number(item.quality?.penalty ?? 0))).toFixed(2)),
      eligibleOutcomes: summarizeOutcomes(eligibleRows.map(item => item.outcome)),
      gatedOutcomes: summarizeOutcomes(gatedRows.map(item => item.outcome)),
    };
  }
  const penaltyByExchange: Record<string, { observations: number; averagePenalty: number; highPenaltyCount: number; maxPenalty: number }> = {};
  for (const row of known) {
    const bucket = known.filter(item => item.exchange === row.exchange);
    penaltyByExchange[row.exchange] = {
      observations: bucket.length,
      averagePenalty: Number(average(bucket.map(item => Number(item.quality?.penalty ?? 0))).toFixed(2)),
      highPenaltyCount: bucket.filter(item => Number(item.quality?.penalty ?? 0) >= 20).length,
      maxPenalty: Math.max(...bucket.map(item => Number(item.quality?.penalty ?? 0))),
    };
  }
  return { observations: known.length, byAssetTimeframe, penaltyByExchange, note: known.length ? "Chỉ gồm snapshot có quality metadata tại thời điểm lưu; không suy diễn cho dữ liệu cũ." : "Chưa có snapshot quality metadata để đánh giá quality gate." };
}
