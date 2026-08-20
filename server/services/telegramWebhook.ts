import crypto from "node:crypto";
import { analyzeAllMarkets, type ExchangeName, type IntervalName, type SymbolName } from "../market/binance";
import { fetchRelevantNews } from "../market/news";
import { createPaperBotAudit, createPaperTrade, createReanalysisRequest, getLastSignal, getNewsAiSettings, getPaperTrades, getRecentReanalysis, getTelegramSettingsByChatId, saveAiAnalysis, saveNewsItem, updatePaperTrade, updateReanalysisRequest } from "../db";
import { answerTelegramCallbackQuery, buildPaperTradeInlineKeyboard, buildSandboxConfirmationKeyboard, formatOnDemandAiAnalysis, formatOnDemandNewsSummary, generateSignalAiAnalysis, sendTelegramMessage } from "./telegram";

export function isValidTelegramWebhookSecret(expected: string, received: string) {
  if (!expected || !received || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

const pausedUsers = new Set<number>();
const pendingSandbox = new Map<string, { userId: number; exchange: string; symbol: string; interval: string; expiresAt: number }>();
export function isPaperBotPaused(userId: number) { return pausedUsers.has(userId); }

type TelegramChat = { id?: number | string };
export type TelegramUpdate = { message?: { chat?: TelegramChat; text?: string }; callback_query?: { id?: string; data?: string; message?: { chat?: TelegramChat } } };

const AI_CALLBACK_RATE_LIMIT_MS = 15 * 60 * 1000;
const ALLOWED_AI_CALLBACK_EXCHANGES = new Set<ExchangeName>(["Binance", "Bybit", "OKX"]);
const ALLOWED_AI_CALLBACK_SYMBOLS = new Set<SymbolName>(["BTCUSDT", "ETHUSDT"]);
const ALLOWED_AI_CALLBACK_INTERVALS = new Set<IntervalName>(["15m", "1h", "4h", "1d"]);
const NEWS_SUMMARY_CALLBACK_RATE_LIMIT_MS = 5 * 60 * 1000;
const recentNewsSummaryRequests = new Map<string, number>();

export function parseAiAnalysisCallback(data: string) {
  const parts = data.split(":");
  if (parts.length !== 5 || parts[0] !== "ai" || parts[1] !== "analyze") return undefined;
  const [, , exchange, symbol, interval] = parts;
  if (!ALLOWED_AI_CALLBACK_EXCHANGES.has(exchange as ExchangeName) || !ALLOWED_AI_CALLBACK_SYMBOLS.has(symbol as SymbolName) || !ALLOWED_AI_CALLBACK_INTERVALS.has(interval as IntervalName)) return undefined;
  return { exchange: exchange as ExchangeName, symbol: symbol as SymbolName, interval: interval as IntervalName };
}

export function parseNewsSummaryCallback(data: string) {
  const parts = data.split(":");
  if (parts.length !== 5 || parts[0] !== "news" || parts[1] !== "summary") return undefined;
  const [, , exchange, symbol, interval] = parts;
  if (interval !== "1h" || !ALLOWED_AI_CALLBACK_EXCHANGES.has(exchange as ExchangeName) || !ALLOWED_AI_CALLBACK_SYMBOLS.has(symbol as SymbolName)) return undefined;
  return { exchange: exchange as ExchangeName, symbol: symbol as SymbolName, interval: "1h" as const };
}

export function clearNewsSummaryCallbackRateLimitForTests() {
  recentNewsSummaryRequests.clear();
}

function parseRssSources(raw: string | undefined) {
  try {
    const sources = JSON.parse(raw ?? "[]");
    return Array.isArray(sources) ? sources.filter((source): source is string => typeof source === "string") : [];
  } catch {
    return [];
  }
}

function commandFromCallback(data: string) {
  if (data.startsWith("paper:")) return data.replace(/^paper:/, "/paper_").replace(/:/g, " ");
  return data;
}

export async function handleTelegramPaperWebhook(update: TelegramUpdate) {
  const callback = update.callback_query;
  const chatId = String(callback?.message?.chat?.id ?? update.message?.chat?.id ?? "");
  const data = callback?.data ?? "";
  const isLiveBlocked = data === "live:blocked";
  if (!chatId) return { ok: true, handled: false };
  const settings = await getTelegramSettingsByChatId(chatId);
  if (!settings) return { ok: true, handled: false };
  let reply = "Lệnh không hợp lệ. Dùng inline keyboard để điều khiển paper bot.";
  let markup = callback ? buildPaperTradeInlineKeyboard(undefined, isPaperBotPaused(settings.userId)) : undefined;
  let handled = true;
  let callbackAnswered = false;

  if (data.startsWith("news:")) {
    const target = parseNewsSummaryCallback(data);
    markup = undefined;
    if (!target) reply = "Nút Tóm tắt tin tức chỉ hỗ trợ tín hiệu BTC/ETH ở khung 1 giờ trên các sàn được hỗ trợ.";
    else {
      if (callback?.id) {
        await answerTelegramCallbackQuery(settings.botToken, callback.id, "Đang tổng hợp tin RSS…");
        callbackAnswered = true;
      }
      const snapshot = await getLastSignal(settings.userId, target.exchange, target.symbol, target.interval);
      if (!snapshot) reply = "Chưa có snapshot tín hiệu 1 giờ đã lưu cho lựa chọn này. Hãy chờ cảnh báo nến đóng tiếp theo.";
      else {
        const rateLimitKey = `${settings.userId}:${snapshot.id}`;
        const lastRequestedAt = recentNewsSummaryRequests.get(rateLimitKey) ?? 0;
        if (Date.now() - lastRequestedAt < NEWS_SUMMARY_CALLBACK_RATE_LIMIT_MS) reply = "Tóm tắt tin tức cho tín hiệu này vừa được yêu cầu. Hãy chờ tối đa 5 phút trước khi thử lại.";
        else {
          try {
            const newsSettings = await getNewsAiSettings(settings.userId);
            if (newsSettings?.enabled === 0) reply = "Thu thập tin tức RSS đang tắt trong cài đặt. Hãy bật lại để dùng Tóm tắt tin tức 1h.";
            else {
              const lookbackHours = newsSettings?.newsLookbackHours ?? 6;
              recentNewsSummaryRequests.set(rateLimitKey, Date.now());
              const news = await fetchRelevantNews(target.symbol, Date.now(), { sources: parseRssSources(newsSettings?.rssSources), lookbackHours });
              await Promise.all(news.map(item => saveNewsItem(settings.userId, { symbol: target.symbol, source: item.source, url: item.url, title: item.title, summary: item.summary, publishedAt: item.publishedAt })));
              reply = formatOnDemandNewsSummary({ exchange: target.exchange, symbol: target.symbol, news, lookbackHours });
              console.info(`[TelegramNews] user=${settings.userId} status=sent target=${target.exchange}:${target.symbol}:1h snapshot=${snapshot.id} items=${news.length}`);
            }
          } catch (error) {
            console.warn(`[TelegramNews] user=${settings.userId} status=failed target=${target.exchange}:${target.symbol}:1h error=${error instanceof Error ? error.message : String(error)}`);
            reply = "Không thể tổng hợp RSS lúc này. Tín hiệu kỹ thuật gốc không thay đổi; hãy thử lại sau.";
          }
        }
      }
    }
  } else if (data.startsWith("ai:")) {
    const target = parseAiAnalysisCallback(data);
    markup = undefined;
    if (!target) reply = "Nút Phân tích AI không hợp lệ hoặc dữ liệu không còn được hỗ trợ.";
    else {
      if (callback?.id) {
        await answerTelegramCallbackQuery(settings.botToken, callback.id, "Đang tạo phân tích AI…");
        callbackAnswered = true;
      }
      const snapshot = await getLastSignal(settings.userId, target.exchange, target.symbol, target.interval);
      if (!snapshot) reply = "Chưa có snapshot tín hiệu đã lưu cho lựa chọn này. Hãy chờ cảnh báo nến đóng tiếp theo.";
      else {
        const recent = await getRecentReanalysis(settings.userId, snapshot.id, AI_CALLBACK_RATE_LIMIT_MS);
        if (recent) reply = "Tín hiệu này đã được yêu cầu phân tích AI trong 15 phút gần đây. Hãy chờ thêm trước khi thử lại.";
        else {
          const requestId = await createReanalysisRequest(settings.userId, snapshot.id);
          try {
            const analysis = (await analyzeAllMarkets()).find(item => item.exchange === target.exchange && item.symbol === target.symbol && item.interval === target.interval);
            if (!analysis) throw new Error("Không tải được dữ liệu kỹ thuật hiện hành");
            const newsSettings = await getNewsAiSettings(settings.userId);
            const news = target.interval === "1h" ? await fetchRelevantNews(target.symbol, Date.now(), { sources: JSON.parse(newsSettings?.rssSources ?? "[]") as string[], lookbackHours: newsSettings?.newsLookbackHours ?? 6 }) : [];
            const aiAnalysis = await generateSignalAiAnalysis(settings.userId, analysis, news);
            await saveAiAnalysis(settings.userId, { snapshotId: snapshot.id, symbol: target.symbol, interval: target.interval, analysis: aiAnalysis });
            await updateReanalysisRequest(requestId, { status: "completed" });
            reply = formatOnDemandAiAnalysis({ ...target, analysis: aiAnalysis });
            console.info(`[TelegramAI] user=${settings.userId} status=completed target=${target.exchange}:${target.symbol}:${target.interval} snapshot=${snapshot.id}`);
          } catch (error) {
            await updateReanalysisRequest(requestId, { status: "failed", error: "Không thể tạo phân tích AI từ callback Telegram" });
            console.warn(`[TelegramAI] user=${settings.userId} status=failed target=${target.exchange}:${target.symbol}:${target.interval} error=${error instanceof Error ? error.message : String(error)}`);
            reply = "AI tạm thời không thể tạo phân tích. Tín hiệu kỹ thuật gốc vẫn không thay đổi; hãy thử lại sau.";
          }
        }
      }
    }
  } else if (data.startsWith("sandbox:")) {
    const parts = data.split(":");
    const action = parts[1];
    if (action === "request") {
      const [, , exchange, symbol, interval] = parts;
      if (!exchange || !symbol || !interval) reply = "Hãy dùng nút Sandbox Trade trên một tin nhắn tín hiệu cụ thể.";
      else {
        const analyses = await analyzeAllMarkets();
        const analysis = analyses.find(item => item.exchange.toLowerCase() === exchange.toLowerCase() && item.symbol.toLowerCase() === symbol.toLowerCase() && item.interval === interval);
        if (!analysis || analysis.signalStatus === "No Trade") reply = "Không có tín hiệu Trade hợp lệ; sandbox order chưa được tạo.";
        else {
          const token = crypto.randomBytes(6).toString("hex");
          pendingSandbox.set(token, { userId: settings.userId, exchange, symbol, interval, expiresAt: Date.now() + 120_000 });
          reply = `Xác nhận Sandbox Trade ${symbol} ${interval} trên ${exchange}?\nHệ thống sẽ mô phỏng Entry ${analysis.levels.entry.toFixed(2)} · TP ${analysis.levels.takeProfit1.toFixed(2)} · SL ${analysis.levels.stopLoss.toFixed(2)}. Không gọi API sàn.`;
          markup = buildSandboxConfirmationKeyboard(token);
          await createPaperBotAudit(settings.userId, "sandbox_pending", `Tạo yêu cầu xác nhận sandbox ${exchange}:${symbol}:${interval}`);
        }
      }
    } else if (action === "confirm") {
      const pending = pendingSandbox.get(parts[2] ?? "");
      if (!pending || pending.userId !== settings.userId || pending.expiresAt < Date.now()) reply = "Yêu cầu Sandbox đã hết hạn hoặc không thuộc tài khoản này.";
      else {
        pendingSandbox.delete(parts[2]);
        const analysis = (await analyzeAllMarkets()).find(item => item.exchange.toLowerCase() === pending.exchange.toLowerCase() && item.symbol.toLowerCase() === pending.symbol.toLowerCase() && item.interval === pending.interval);
        if (!analysis || analysis.signalStatus === "No Trade") reply = "Tín hiệu đã thay đổi; sandbox order không được tạo.";
        else {
          const direction = analysis.indicators.label === "Bearish" ? "Short" : "Long";
          const trade = await createPaperTrade({ userId: settings.userId, exchange: analysis.exchange, symbol: analysis.symbol, interval: analysis.interval, direction, entry: analysis.levels.entry, takeProfit: analysis.levels.takeProfit1, stopLoss: analysis.levels.stopLoss, currentPrice: analysis.price, openedAt: Date.now(), sourceSignalKey: `sandbox:${analysis.exchange}:${analysis.symbol}:${analysis.interval}:${analysis.candleOpenTime}` });
          await createPaperBotAudit(settings.userId, "sandbox_confirmed", `Xác nhận Sandbox Trade #${trade?.id ?? "—"}; không gọi API sàn`);
          reply = `Sandbox Trade #${trade?.id ?? "—"} đã mở.\nHướng: ${direction}\nEntry: ${analysis.levels.entry.toFixed(2)} · TP: ${analysis.levels.takeProfit1.toFixed(2)} · SL: ${analysis.levels.stopLoss.toFixed(2)}\nĐây là mô phỏng, không phải lệnh thật.`;
          markup = buildPaperTradeInlineKeyboard(trade?.id, isPaperBotPaused(settings.userId));
        }
      }
    } else if (action === "cancel") {
      pendingSandbox.delete(parts[2] ?? "");
      await createPaperBotAudit(settings.userId, "sandbox_cancelled", "Hủy xác nhận Sandbox Trade");
      reply = "Đã hủy Sandbox Trade; không có lệnh nào được tạo.";
    }
  } else if (isLiveBlocked) {
    reply = "Live Trade đang khóa. Sandbox API là môi trường duy nhất đang bật; không dùng credentials thật và không có lệnh có giá trị.";
    await createPaperBotAudit(settings.userId, "live_blocked_attempt", "Telegram Live Trade bị chặn trong sandbox");
  } else {
    const rawText = callback?.data ? commandFromCallback(callback.data) : (update.message?.text ?? "").trim();
    const command = rawText.split(/\s+/);
    const name = command[0].toLowerCase();
    let tradeId: number | undefined;
    if (name === "/paper_pause" || name === "/paper_resume") {
      if (name === "/paper_pause") pausedUsers.add(settings.userId); else pausedUsers.delete(settings.userId);
      await createPaperBotAudit(settings.userId, name.slice(1), `Telegram ${callback ? "inline callback" : "command"} ${name}; chỉ áp dụng paper bot`);
      reply = name === "/paper_pause" ? "Paper bot đã tạm dừng refresh TP/SL." : "Paper bot đã được tiếp tục refresh TP/SL.";
    } else if (name === "/paper_open") {
      const [, exchange, symbol, interval] = command;
      const analysis = (await analyzeAllMarkets()).find(item => item.exchange.toLowerCase() === exchange?.toLowerCase() && item.symbol.toLowerCase() === symbol?.toLowerCase() && item.interval === interval);
      if (!analysis || analysis.signalStatus === "No Trade") reply = "Không tìm thấy tín hiệu Trade phù hợp; không mở paper trade.";
      else { const direction = analysis.indicators.label === "Bearish" ? "Short" : "Long"; const trade = await createPaperTrade({ userId: settings.userId, exchange: analysis.exchange, symbol: analysis.symbol, interval: analysis.interval, direction, entry: analysis.levels.entry, takeProfit: analysis.levels.takeProfit1, stopLoss: analysis.levels.stopLoss, currentPrice: analysis.price, openedAt: Date.now(), sourceSignalKey: `${analysis.exchange}:${analysis.symbol}:${analysis.interval}:${analysis.candleOpenTime}` }); tradeId = trade?.id; await createPaperBotAudit(settings.userId, "paper_open_telegram", `Mở ${direction} ${analysis.symbol} từ Telegram; không phải lệnh live`); reply = `Đã mở paper trade #${tradeId ?? "—"} ${direction} ${analysis.symbol} ${analysis.interval}. Entry ${analysis.levels.entry.toFixed(2)} · TP ${analysis.levels.takeProfit1.toFixed(2)} · SL ${analysis.levels.stopLoss.toFixed(2)}.`; }
    } else if (name === "/paper_close") {
      const id = Number(command[1]); const trade = (await getPaperTrades(settings.userId, 200)).find(item => item.id === id && item.status === "open");
      if (!trade) reply = "Không tìm thấy paper trade đang mở với ID này.";
      else { const pnlPercent = ((trade.currentPrice - trade.entry) / trade.entry) * (trade.direction === "Long" ? 100 : -100); const durationMinutes = Math.max(0, Math.round((Date.now() - trade.openedAt) / 60_000)); await updatePaperTrade(trade.id, settings.userId, { currentPrice: trade.currentPrice, status: "cancelled", closedAt: Date.now(), exitPrice: trade.currentPrice, pnlPercent }); await createPaperBotAudit(settings.userId, "paper_close_telegram", `Đóng paper trade #${trade.id}; P&L ${pnlPercent.toFixed(3)}%`); reply = `Đã đóng paper trade #${trade.id}.\nHướng: ${trade.direction}\nEntry: ${trade.entry.toFixed(2)}\nExit: ${trade.currentPrice.toFixed(2)}\nP&L: <b>${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(3)}%</b>\nThời gian giữ: ${durationMinutes} phút\nKhông có lệnh live được gửi.`; }
    } else { handled = false; }
    if (callback) markup = buildPaperTradeInlineKeyboard(tradeId, isPaperBotPaused(settings.userId));
  }
  if (handled) {
    await sendTelegramMessage(settings.botToken, chatId, reply, markup);
    if (callback?.id && !callbackAnswered) await answerTelegramCallbackQuery(settings.botToken, callback.id, reply.replace(/<[^>]+>/g, "").slice(0, 180));
  }
  return { ok: true, handled };
}
