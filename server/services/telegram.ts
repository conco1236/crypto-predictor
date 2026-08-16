import { MarketAnalysis } from "../market/binance";

export type TelegramSendResult = { ok: boolean; result?: { message_id?: number }; description?: string; error_code?: number };

export async function sendTelegramMessage(botToken: string, chatId: string, text: string): Promise<TelegramSendResult> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const payload = await response.json().catch(() => null) as TelegramSendResult | null;
  if (!response.ok || payload?.ok === false) {
    const detail = payload?.description ? `: ${payload.description}` : "";
    throw new Error(`Telegram trả về HTTP ${response.status}${detail}`);
  }
  return payload ?? { ok: true };
}

export function formatSignalAlert(analysis: MarketAnalysis) {
  const i = analysis.indicators;
  const l = analysis.levels;
  const confidenceReasons = i.confidenceReasons ?? [];
  const dataQuality = analysis.dataQuality ?? { candleCount: analysis.candles.length, closedCandleCount: analysis.candles.length, sourceLatencyMs: 0, warnings: [] };
  return [
    `<b>Crypto Trend Signal — ${analysis.symbol.replace("USDT", "")}</b>`,
    `Sàn: <b>${analysis.exchange}</b> | Khung: <b>${analysis.interval}</b> | Tín hiệu: <b>${i.label}</b> (${i.score > 0 ? "+" : ""}${i.score}/100)`,
    `Confidence ước tính: <b>${i.confidence ?? "—"}/100</b>${confidenceReasons.length ? ` — ${confidenceReasons.slice(0, 2).join("; ")}` : ""}`,
    `Nến đóng: <b>${new Date(analysis.candleClosedAt).toLocaleString("vi-VN")}</b>`,
    `Giá: <b>${analysis.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> | 24h: ${analysis.change24h >= 0 ? "+" : ""}${analysis.change24h.toFixed(2)}%`,
    `Kế hoạch: ${l.side} | Entry ${l.entry.toFixed(2)} | TP1 ${l.takeProfit1.toFixed(2)} | TP2 ${l.takeProfit2.toFixed(2)} | SL ${l.stopLoss.toFixed(2)}`,
    `RSI ${i.rsi.toFixed(1)} | ADX ${i.adx.toFixed(1)} | ATR ${i.atr.toFixed(2)} | Volume x${i.volumeRatio.toFixed(2)}`,
    `Dữ liệu: ${dataQuality.candleCount} nến, ${dataQuality.closedCandleCount} nến đã đóng, độ trễ nguồn ${dataQuality.sourceLatencyMs}ms${dataQuality.warnings.length ? ` — ${dataQuality.warnings.join("; ")}` : ""}`,
    `<i>Chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</i>`,
  ].join("\n");
}
