export type RiskTooltipInput = {
  atr: number;
  adx: number;
  volumeRatio: number;
  rsi: number;
  entry: number;
  stopLoss: number;
};

export function getRiskTooltipDetails(input: RiskTooltipInput): Array<[string, string]> {
  return [
    ["ATR / biến động", `ATR ${input.atr.toFixed(4)} — biên độ dao động và độ rộng vùng rủi ro.`],
    ["ADX / xu hướng", `ADX ${input.adx.toFixed(1)} — sức mạnh xu hướng hiện tại.`],
    ["Volume", `x${input.volumeRatio.toFixed(2)} trung bình — mức xác nhận của dòng tiền.`],
    ["RSI", `${input.rsi.toFixed(1)} — trạng thái quá mua/quá bán.`],
    ["Entry → Stop Loss", `${Math.abs(input.entry - input.stopLoss).toFixed(4)} — khoảng đệm rủi ro của kịch bản.`],
  ];
}
