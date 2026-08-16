import type { MarketAnalysis } from "../market/binance";
import { invokeLLM } from "../_core/llm";

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

export async function generateSignalAiAnalysis(analysis: MarketAnalysis) {
  const i = analysis.indicators;
  const l = analysis.levels;
  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Bạn là chuyên gia phân tích crypto. Trả lời hoàn toàn bằng tiếng Việt, tối đa 3 câu, chỉ dùng dữ liệu được cung cấp. Nêu xu hướng, điều kiện xác nhận/vô hiệu hóa và rủi ro. Không bịa tin tức, không hứa hẹn lợi nhuận và nhắc đây không phải khuyến nghị đầu tư." },
        { role: "user", content: `Phân tích tín hiệu ${analysis.symbol} ${analysis.interval} trên ${analysis.exchange}. Xu hướng ${i.label}, điểm ${i.score}/100, confidence ${i.confidence}/100, RSI ${i.rsi.toFixed(1)}, ADX ${i.adx.toFixed(1)}, ATR ${i.atr.toFixed(2)}, volume x${i.volumeRatio.toFixed(2)}, Entry ${l.entry.toFixed(2)}, TP1 ${l.takeProfit1.toFixed(2)}, SL ${l.stopLoss.toFixed(2)}. Lý do: ${(i.reasons ?? []).slice(0, 4).join("; ")}` },
      ],
      reasoning: { effort: "low" },
    });
    const content = response.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content.trim() : "AI không trả về phân tích; tham khảo các chỉ báo kỹ thuật bên dưới.";
  } catch (error) {
    console.warn("[TelegramAI] fallback", error instanceof Error ? error.message : String(error));
    return "AI tạm thời không khả dụng; tín hiệu vẫn dựa trên các chỉ báo kỹ thuật và mức Entry/TP/SL bên dưới.";
  }
}

function escapeTelegramHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatSignalAlert(analysis: MarketAnalysis, aiAnalysis?: string) {
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
    `<b>Phân tích AI:</b> ${escapeTelegramHtml(aiAnalysis ?? "Chưa tạo phân tích AI cho lần gửi này.")}`,
    `<i>Chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</i>`,
  ].join("\n");
}
