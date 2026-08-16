import type { MarketAnalysis } from "../market/binance";
import type { NewsItem } from "../market/news";
import { invokeLLM } from "../_core/llm";

export type TelegramSendResult = { ok: boolean; result?: { message_id?: number }; description?: string; error_code?: number };
export type TelegramInlineKeyboard = { inline_keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> };

export function buildSandboxConfirmationKeyboard(token: string): TelegramInlineKeyboard {
  return { inline_keyboard: [[{ text: "Xác nhận Sandbox Trade", callback_data: `sandbox:confirm:${token}` }, { text: "Hủy", callback_data: `sandbox:cancel:${token}` }]] };
}

export function buildPaperTradeInlineKeyboard(tradeId?: number, paused = false): TelegramInlineKeyboard {
  const controls = tradeId ? [{ text: "Đóng paper", callback_data: `paper:close:${tradeId}` }] : [{ text: "Mở paper", callback_data: "paper:open" }];
  controls.push({ text: paused ? "Tiếp tục bot" : "Tạm dừng bot", callback_data: paused ? "paper:resume" : "paper:pause" });
  controls.push({ text: "Sandbox Trade", callback_data: "sandbox:request" });
  controls.push({ text: "Live Trade · khóa", callback_data: "live:blocked" });
  return { inline_keyboard: [controls] };
}

export function buildSignalInlineKeyboard(analysis: MarketAnalysis): TelegramInlineKeyboard {
  const chartSymbol = `${analysis.exchange.toUpperCase()}:${analysis.symbol}`;
  const chartUrl = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(chartSymbol)}`;
  const appUrl = process.env.PUBLIC_APP_URL ?? "https://cryptosig-2awoct8z.manus.space";
  const liquidityUrl = `${appUrl}/?focus=liquidity&exchange=${encodeURIComponent(analysis.exchange)}&symbol=${encodeURIComponent(analysis.symbol)}&interval=${encodeURIComponent(analysis.interval)}`;
  const paperUrl = `${appUrl}/?page=trading-bot&focus=paper`;
  const pnlUrl = `${appUrl}/?page=trading-bot&focus=pnl`;
  const openPaper = { text: "Mở paper trade", callback_data: `paper:open:${analysis.exchange}:${analysis.symbol}:${analysis.interval}` };
  const sandbox = { text: "Sandbox Trade", callback_data: `sandbox:request:${analysis.exchange}:${analysis.symbol}:${analysis.interval}` };
  return { inline_keyboard: [[{ text: "Xem biểu đồ", url: chartUrl }, { text: "Kiểm tra thanh khoản", url: liquidityUrl }], [openPaper, sandbox, { text: "Mở Paper Bot", url: paperUrl }, { text: "Xem P&L", url: pnlUrl }]] };
}

export async function answerTelegramCallbackQuery(botToken: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false }) });
}

export async function sendTelegramMessage(botToken: string, chatId: string, text: string, replyMarkup?: TelegramInlineKeyboard): Promise<TelegramSendResult> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...(replyMarkup ? { reply_markup: replyMarkup } : {}) }),
  });
  const payload = await response.json().catch(() => null) as TelegramSendResult | null;
  if (!response.ok || payload?.ok === false) {
    const detail = payload?.description ? `: ${payload.description}` : "";
    throw new Error(`Telegram trả về HTTP ${response.status}${detail}`);
  }
  return payload ?? { ok: true };
}

export async function generateSignalAiAnalysis(analysis: MarketAnalysis, news: NewsItem[] = []) {
  const i = analysis.indicators;
  const l = analysis.levels;
  try {
    const newsContext = news.length ? news.map(item => `- ${item.source} | ${new Date(item.publishedAt).toISOString()} | ${item.title} | ${item.url}`).join("\n") : "Không có tin liên quan trong 6 giờ gần nhất; không suy đoán tin tức.";
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Bạn là chuyên gia phân tích crypto. Trả lời hoàn toàn bằng tiếng Việt, tối đa 3 câu, chỉ dùng dữ liệu được cung cấp. Nêu xu hướng, điều kiện xác nhận/vô hiệu hóa và rủi ro. Không bịa tin tức, không hứa hẹn lợi nhuận và nhắc đây không phải khuyến nghị đầu tư." },
        { role: "user", content: `Phân tích tín hiệu ${analysis.symbol} ${analysis.interval} trên ${analysis.exchange}. Xu hướng ${i.label}, trạng thái ${analysis.signalStatus ?? "Trade"}, lý do trạng thái ${analysis.signalReason ?? "không có"}, đồng thuận khung ${(analysis.timeframeConfirmation?.alignedIntervals ?? []).join(", ") || "không có"}, xung đột khung ${(analysis.timeframeConfirmation?.conflictingIntervals ?? []).join(", ") || "không có"}, điểm ${i.score}/100, confidence ${i.confidence}/100, RSI ${i.rsi.toFixed(1)}, ADX ${i.adx.toFixed(1)}, ATR ${i.atr.toFixed(2)}, volume x${i.volumeRatio.toFixed(2)}, liquidity ${analysis.liquidity?.isValid ? "đạt" : "không đạt"}, liquidity warnings ${(analysis.liquidity?.warnings ?? []).join("; ") || "không có"}, Entry ${l.entry.toFixed(2)}, TP1 ${l.takeProfit1.toFixed(2)}, SL ${l.stopLoss.toFixed(2)}. Lý do kỹ thuật: ${(i.reasons ?? []).slice(0, 4).join("; ")}. Tin tức có nguồn trong 6 giờ gần nhất:\n${newsContext}` },
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

export function formatSignalAlert(analysis: MarketAnalysis, aiAnalysis?: string, news: NewsItem[] = []) {
  const i = analysis.indicators;
  const l = analysis.levels;
  const confidenceReasons = i.confidenceReasons ?? [];
  const dataQuality = analysis.dataQuality ?? { candleCount: analysis.candles.length, closedCandleCount: analysis.candles.length, sourceLatencyMs: 0, warnings: [] };
  return [
    `<b>Crypto Trend Signal — ${analysis.symbol.replace("USDT", "")}</b>`,
    `Sàn: <b>${analysis.exchange}</b> | Khung: <b>${analysis.interval}</b> | Tín hiệu: <b>${i.label}</b> (${i.score > 0 ? "+" : ""}${i.score}/100)`,
    `Trạng thái: <b>${analysis.signalStatus ?? "Trade"}</b>${analysis.signalReason ? ` — ${escapeTelegramHtml(analysis.signalReason)}` : ""}`,
    `Confidence ước tính: <b>${i.confidence ?? "—"}/100</b>${confidenceReasons.length ? ` — ${confidenceReasons.slice(0, 2).join("; ")}` : ""}`,
    `Nến đóng: <b>${new Date(analysis.candleClosedAt).toLocaleString("vi-VN")}</b>`,
    `Giá: <b>${analysis.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> | 24h: ${analysis.change24h >= 0 ? "+" : ""}${analysis.change24h.toFixed(2)}%`,
    `Kế hoạch: ${l.side} | Entry ${l.entry.toFixed(2)} | TP1 ${l.takeProfit1.toFixed(2)} | TP2 ${l.takeProfit2.toFixed(2)} | SL ${l.stopLoss.toFixed(2)}`,
    `RSI ${i.rsi.toFixed(1)} | ADX ${i.adx.toFixed(1)} | ATR ${i.atr.toFixed(2)} | Volume x${i.volumeRatio.toFixed(2)}`,
    `Dữ liệu: ${dataQuality.candleCount} nến, ${dataQuality.closedCandleCount} nến đã đóng, độ trễ nguồn ${dataQuality.sourceLatencyMs}ms${dataQuality.warnings.length ? ` — ${dataQuality.warnings.join("; ")}` : ""}`,
    analysis.liquidity ? `Thanh khoản: <b>${analysis.liquidity.isValid ? "Đạt" : "Không đạt"}</b> | Spread ${analysis.liquidity.spreadBps.toFixed(1)} bps | Depth ±0.5% $${Math.round(analysis.liquidity.depthUsd).toLocaleString("en-US")} | Volume x${analysis.liquidity.volumeRatio.toFixed(2)}${analysis.liquidity.warnings.length ? ` — ${escapeTelegramHtml(analysis.liquidity.warnings.join("; "))}` : ""}` : "Thanh khoản: chưa xác thực",
    `<b>Phân tích AI:</b> ${escapeTelegramHtml(aiAnalysis ?? "Chưa tạo phân tích AI cho lần gửi này.")}`,
    ...(analysis.interval === "1h" ? [news.length ? `<b>Tin liên quan 1h:</b>\n${news.slice(0, 3).map(item => `• ${escapeTelegramHtml(item.source)} · ${escapeTelegramHtml(item.title)} · ${new Date(item.publishedAt).toLocaleString("vi-VN")}\n  ${escapeTelegramHtml(item.url)}`).join("\n")}` : `<b>Tin liên quan 1h:</b> Không có tin phù hợp trong 6 giờ gần nhất.`] : []),
    `<i>Chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</i>`,
  ].join("\n");
}
