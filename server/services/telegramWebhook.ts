import crypto from "node:crypto";
import { analyzeAllMarkets } from "../market/binance";
import { createPaperBotAudit, createPaperTrade, getPaperTrades, getTelegramSettingsByChatId, updatePaperTrade } from "../db";
import { sendTelegramMessage } from "./telegram";

export function isValidTelegramWebhookSecret(expected: string, received: string) {
  if (!expected || !received || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

const pausedUsers = new Set<number>();
export function isPaperBotPaused(userId: number) { return pausedUsers.has(userId); }

export type TelegramUpdate = { message?: { chat?: { id?: number | string }; text?: string } };

export async function handleTelegramPaperWebhook(update: TelegramUpdate) {
  const chatId = String(update.message?.chat?.id ?? "");
  const text = (update.message?.text ?? "").trim();
  if (!chatId || !text) return { ok: true, handled: false };
  const settings = await getTelegramSettingsByChatId(chatId);
  if (!settings) return { ok: true, handled: false };
  const command = text.split(/\s+/);
  const name = command[0].toLowerCase();
  let reply = "Lệnh không hợp lệ. Dùng /paper_open, /paper_close <id>, /paper_pause hoặc /paper_resume.";
  if (name === "/paper_pause" || name === "/paper_resume") {
    if (name === "/paper_pause") pausedUsers.add(settings.userId); else pausedUsers.delete(settings.userId);
    await createPaperBotAudit(settings.userId, name.slice(1), `Telegram command ${name}; chỉ áp dụng paper bot`);
    reply = name === "/paper_pause" ? "Paper bot đã tạm dừng refresh TP/SL." : "Paper bot đã được tiếp tục refresh TP/SL.";
  } else if (name === "/paper_open") {
    const [, exchange, symbol, interval] = command;
    const analyses = await analyzeAllMarkets();
    const analysis = analyses.find(item => item.exchange.toLowerCase() === exchange?.toLowerCase() && item.symbol.toLowerCase() === symbol?.toLowerCase() && item.interval === interval);
    if (!analysis || analysis.signalStatus === "No Trade") reply = "Không tìm thấy tín hiệu Trade phù hợp; không mở paper trade.";
    else {
      const direction = analysis.indicators.label === "Bearish" ? "Short" : "Long";
      await createPaperTrade({ userId: settings.userId, exchange: analysis.exchange, symbol: analysis.symbol, interval: analysis.interval, direction, entry: analysis.levels.entry, takeProfit: analysis.levels.takeProfit1, stopLoss: analysis.levels.stopLoss, currentPrice: analysis.price, openedAt: Date.now(), sourceSignalKey: `${analysis.exchange}:${analysis.symbol}:${analysis.interval}:${analysis.candleOpenTime}` });
      await createPaperBotAudit(settings.userId, "paper_open_telegram", `Mở ${direction} ${analysis.symbol} từ Telegram; không phải lệnh live`);
      reply = `Đã mở paper trade ${direction} ${analysis.symbol} ${analysis.interval}. Entry ${analysis.levels.entry.toFixed(2)} · TP ${analysis.levels.takeProfit1.toFixed(2)} · SL ${analysis.levels.stopLoss.toFixed(2)}.`;
    }
  } else if (name === "/paper_close") {
    const id = Number(command[1]);
    const trades = await getPaperTrades(settings.userId, 200);
    const trade = trades.find(item => item.id === id && item.status === "open");
    if (!trade) reply = "Không tìm thấy paper trade đang mở với ID này.";
    else { await updatePaperTrade(trade.id, settings.userId, { currentPrice: trade.currentPrice, status: "cancelled", closedAt: Date.now(), exitPrice: trade.currentPrice, pnlPercent: ((trade.currentPrice - trade.entry) / trade.entry) * (trade.direction === "Long" ? 100 : -100) }); await createPaperBotAudit(settings.userId, "paper_close_telegram", `Đóng paper trade #${trade.id} từ Telegram`); reply = `Đã đóng paper trade #${trade.id}. Không có lệnh live được gửi.`; }
  }
  await sendTelegramMessage(settings.botToken, chatId, reply);
  return { ok: true, handled: true };
}
