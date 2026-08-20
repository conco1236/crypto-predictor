export type SignalQualityInput = {
  baseConfidence: number;
  sourceLatencyMs: number;
  dataWarnings: string[];
  liquidityValid: boolean;
  crossExchangeVolumeAgreement: boolean;
  priceDeviationBps: number;
  directionalAgreement: number;
  conflictingExchanges: number;
};

export type SignalQualityResult = {
  confidence: number;
  penalty: number;
  isTradeEligible: boolean;
  reasons: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function assessSignalQuality(input: SignalQualityInput): SignalQualityResult {
  let penalty = 0;
  const reasons: string[] = [];
  if (input.dataWarnings.length) { penalty += 10; reasons.push("Dữ liệu nến chưa đầy đủ hoặc có cảnh báo nguồn"); }
  if (input.sourceLatencyMs > 8_000) { penalty += 8; reasons.push(`Độ trễ nguồn ${input.sourceLatencyMs}ms vượt ngưỡng chất lượng`); }
  if (!input.liquidityValid) { penalty += 14; reasons.push("Thanh khoản hoặc spread chưa đạt điều kiện xác nhận"); }
  if (!input.crossExchangeVolumeAgreement) { penalty += 8; reasons.push("Volume lệch đáng kể giữa các sàn"); }
  if (input.priceDeviationBps > 20) { penalty += 12; reasons.push(`Giá lệch ${input.priceDeviationBps.toFixed(1)} bps so với median liên sàn`); }
  if (input.directionalAgreement < 2) { penalty += 12; reasons.push("Chưa có ít nhất hai sàn đồng thuận cùng hướng"); }
  if (input.conflictingExchanges > 0) { penalty += 8; reasons.push("Có sàn xung đột hướng với tín hiệu hiện tại"); }
  const isTradeEligible = input.liquidityValid && input.priceDeviationBps <= 35 && input.directionalAgreement >= 2 && input.conflictingExchanges === 0;
  if (!isTradeEligible) reasons.push("Quality gate không cho phép nâng trạng thái Trade");
  return { confidence: clamp(input.baseConfidence - penalty), penalty, isTradeEligible, reasons };
}
