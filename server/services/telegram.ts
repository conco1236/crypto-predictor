import { MarketAnalysis } from "../market/binance";

export async function sendTelegramMessage(botToken: string, chatId: string, text: string) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram trả về HTTP ${response.status}`);
  return response.json();
}

export function formatSignalAlert(analysis: MarketAnalysis) {
  const i = analysis.indicators;
  const l = analysis.levels;
  return [
    `<b>Crypto Trend Signal — ${analysis.symbol.replace("USDT", "")}</b>`,
    `Sàn: <b>${analysis.exchange}</b> | Khung: <b>${analysis.interval}</b> | Tín hiệu: <b>${i.label}</b> (${i.score > 0 ? "+" : ""}${i.score}/100)`,
    `Giá: <b>${analysis.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</b> | 24h: ${analysis.change24h >= 0 ? "+" : ""}${analysis.change24h.toFixed(2)}%`,
    `Kế hoạch: ${l.side} | Entry ${l.entry.toFixed(2)} | TP1 ${l.takeProfit1.toFixed(2)} | TP2 ${l.takeProfit2.toFixed(2)} | SL ${l.stopLoss.toFixed(2)}`,
    `RSI ${i.rsi.toFixed(1)} | ADX ${i.adx.toFixed(1)} | ATR ${i.atr.toFixed(2)} | Volume x${i.volumeRatio.toFixed(2)}`,
    `<i>Chỉ mang tính tham khảo, không phải khuyến nghị đầu tư.</i>`,
  ].join("\n");
}
