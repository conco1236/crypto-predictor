import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { analyzeAllMarkets, fetchExchangeCandles, type ExchangeName, type IntervalName, type SymbolName } from "./market/binance";
import { calibrateConfidence, evaluateSignalOutcome, summarizeOutcomes } from "./market/outcomes";
import { fetchRelevantNews } from "./market/news";
import { createReanalysisRequest, createTelegramDeliveryLog, deleteTelegramAlertRule, getHeartbeatHistory, getHeartbeatHistoryPage, getLastSignal, getProcessedCandle, getRecentReanalysis, getRiskHistories, getRiskHistory, getSignalHistory, getSignalSnapshotById, getTelegramAlertRules, getTelegramDeliveryHistory, getTelegramDeliveryHistoryPage, getTelegramDeliveryLog, getTelegramDeliveryLogById, getTelegramSettings, getSignalOutcomes, getNewsAiSettings, getNewsHistory, getNewsHistoryPage, getAiHistory, getAiHistoryPage, markProcessedCandle, saveAiAnalysis, saveNewsAiSettings, saveNewsItem, saveSignalSnapshot, saveTelegramSettings, updateReanalysisRequest, updateTelegramDeliveryLog, upsertSignalOutcome, upsertTelegramAlertRule } from "./db";
import { buildSignalInlineKeyboard, formatSignalAlert, generateSignalAiAnalysis, sendTelegramMessage } from "./services/telegram";
import { resolveAlertRule } from "./services/alertRules";

function responseText(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : JSON.stringify(content ?? "");
}

const analysisInput = z.array(z.object({
  exchange: z.string(), symbol: z.string(), interval: z.string(), price: z.number(), label: z.string(), score: z.number(),
  rsi: z.number(), adx: z.number(), atr: z.number(), volumeRatio: z.number(), entry: z.number(), takeProfit1: z.number(), stopLoss: z.number(), reasons: z.array(z.string()), signalStatus: z.string().optional(), signalReason: z.string().optional(), liquidityWarnings: z.array(z.string()).optional(),
}));

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  market: router({
    all: protectedProcedure.query(async () => analyzeAllMarkets()),
    aiSummary: protectedProcedure.input(analysisInput).mutation(async ({ input }) => {
      const compact = input.map(item => `${item.exchange} — ${item.symbol} ${item.interval}: ${item.label} score ${item.score}, trạng thái ${item.signalStatus ?? "Trade"}, lý do ${item.signalReason ?? "không có"}, giá ${item.price}, RSI ${item.rsi.toFixed(1)}, ADX ${item.adx.toFixed(1)}, ATR ${item.atr.toFixed(2)}, volume x${item.volumeRatio.toFixed(2)}, Entry ${item.entry.toFixed(2)}, TP ${item.takeProfit1.toFixed(2)}, SL ${item.stopLoss.toFixed(2)}, liquidity ${item.liquidityWarnings?.join("; ") || "đạt"}; ${item.reasons.join(", ")}`).join("\n");
      const result = await invokeLLM({
        messages: [
          { role: "system", content: "Bạn là chuyên gia phân tích thị trường crypto. Hãy trả lời hoàn toàn bằng tiếng Việt, ngắn gọn nhưng sâu sắc. Chỉ sử dụng dữ liệu được cung cấp, không bịa thêm giá hoặc tin tức. Nêu rõ xu hướng chính, sự đồng thuận đa khung, rủi ro và điều kiện vô hiệu hóa. Đây là thông tin tham khảo, không phải khuyến nghị đầu tư." },
          { role: "user", content: `Phân tích dữ liệu kỹ thuật BTC/ETH đa khung sau đây và viết bản tóm tắt có cấu trúc với các tiêu đề: Bối cảnh, Tín hiệu chính, Kịch bản, Rủi ro.\n\n${compact}` },
        ],
        reasoning: { effort: "low" },
      });
      return { summary: responseText(result), generatedAt: Date.now() };
    }),
    persist: protectedProcedure.mutation(async ({ ctx }) => {
      const analyses = await analyzeAllMarkets();
      const settings = await getTelegramSettings(ctx.user.id);
      const newsSettings = await getNewsAiSettings(ctx.user.id);
      const rules = await getTelegramAlertRules(ctx.user.id);
      const persistedOutcomes = await getSignalOutcomes(ctx.user.id, 200);
      let saved = 0;
      let alerts = 0;
      for (const a of analyses) {
        const processed = await getProcessedCandle(ctx.user.id, a.exchange, a.symbol, a.interval);
        if (processed && processed.candleOpenTime >= a.candleOpenTime) continue;
        const alertSettings = settings ? resolveAlertRule(settings, rules, { exchange: a.exchange, symbol: a.symbol, interval: a.interval }) : undefined;
        await saveSignalSnapshot({ userId: ctx.user.id, exchange: a.exchange, symbol: a.symbol, interval: a.interval, price: a.price, label: a.indicators.label, score: a.indicators.score, entry: a.levels.entry, takeProfit1: a.levels.takeProfit1, takeProfit2: a.levels.takeProfit2, stopLoss: a.levels.stopLoss, indicators: JSON.stringify({ ...a.indicators, risk: a.risk, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt }) });
        saved++;
        const strongSignal = Boolean(alertSettings && (a.signalStatus ?? "Trade") === "Trade" && (a.liquidity?.isValid ?? true) && Math.abs(a.indicators.score) >= alertSettings.alertThreshold);
        const modeAllowsAlert = (alertSettings?.sendMode ?? "all_candles") === "all_candles" || strongSignal;
        const shouldAlert = Boolean(alertSettings?.enabled && alertSettings.botToken && alertSettings.chatId && modeAllowsAlert);
        if (!shouldAlert) {
          await markProcessedCandle({ userId: ctx.user.id, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime });
          continue;
        }
        const calibrated = calibrateConfidence(a.indicators.confidence, persistedOutcomes.map(row => ({ direction: a.indicators.label, signalCandleOpenTime: row.signalCandleOpenTime, result: row.outcome, exitCandleOpenTime: row.exitCandleOpenTime ?? undefined, exitPrice: row.exitPrice ?? undefined, returnPercent: row.returnPercent, candlesObserved: row.candlesObserved, reason: row.reason ?? "" })));
        const calibratedAnalysis = { ...a, indicators: { ...a.indicators, confidence: calibrated.confidence } };
        const configuredIntervals = newsSettings ? (JSON.parse(newsSettings.aiIntervals) as string[]) : ["1h"];
        const aiEnabled = newsSettings?.enabled !== 0 && configuredIntervals.includes(a.interval);
        const news = aiEnabled && a.interval === "1h" ? await fetchRelevantNews(a.symbol, Date.now(), { sources: JSON.parse(newsSettings?.rssSources ?? "[]") as string[], lookbackHours: newsSettings?.newsLookbackHours ?? 6 }) : [];
        for (const item of news) await saveNewsItem(ctx.user.id, { symbol: a.symbol, source: item.source, url: item.url, title: item.title, summary: item.summary, publishedAt: item.publishedAt });
        const aiAnalysis = aiEnabled ? await generateSignalAiAnalysis(calibratedAnalysis, news) : "Phân tích AI đã tắt trong cài đặt người dùng; tín hiệu kỹ thuật vẫn được lưu.";
        await saveAiAnalysis(ctx.user.id, { symbol: a.symbol, interval: a.interval, analysis: aiAnalysis, newsItemIds: [] });
        const message = formatSignalAlert(calibratedAnalysis, aiAnalysis, news);
        const delivery = await createTelegramDeliveryLog({ userId: ctx.user.id, exchange: a.exchange, interval: a.interval, symbol: a.symbol, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt, label: a.indicators.label, score: a.indicators.score, message });
        const attempts = delivery?.attempts ?? 0;
        await updateTelegramDeliveryLog(delivery!.id, { status: "pending", attempts: attempts + 1, lastError: null });
        try {
          const result = await sendTelegramMessage(alertSettings!.botToken, alertSettings!.chatId, message, buildSignalInlineKeyboard(a));
          await updateTelegramDeliveryLog(delivery!.id, { status: "sent", telegramMessageId: result.result?.message_id ? String(result.result.message_id) : null, lastError: null, sentAt: new Date() });
          await markProcessedCandle({ userId: ctx.user.id, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime });
          alerts++;
        } catch (error) {
          const messageError = error instanceof Error ? error.message : String(error);
          await updateTelegramDeliveryLog(delivery!.id, { status: "failed", lastError: messageError });
        }
      }
      return { saved, alerts, updatedAt: Date.now() };
    }),
    history: protectedProcedure.input(z.object({ limit: z.number().min(1).max(200).default(40), symbol: z.string().max(20).optional(), interval: z.enum(["15m", "1h", "4h", "1d"]).optional() })).query(({ ctx, input }) => getSignalHistory(ctx.user.id, input.limit, { symbol: input.symbol, interval: input.interval })),
    timeline: protectedProcedure.input(z.object({ symbol: z.enum(["BTCUSDT", "ETHUSDT"]), interval: z.enum(["15m", "1h", "4h", "1d"]).default("1h"), limit: z.number().int().min(10).max(100).default(60) })).query(async ({ ctx, input }) => ({ prices: await getSignalHistory(ctx.user.id, input.limit, { symbol: input.symbol, interval: input.interval }), news: await getNewsHistory(ctx.user.id, input.limit, input.symbol) })),
    reanalyze: protectedProcedure.input(z.object({ snapshotId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const snapshot = await getSignalSnapshotById(ctx.user.id, input.snapshotId);
      if (!snapshot) throw new Error("Không tìm thấy tín hiệu hoặc bạn không có quyền truy cập");
      const recent = await getRecentReanalysis(ctx.user.id, input.snapshotId);
      if (recent) throw new Error("Tín hiệu này chỉ được phân tích lại một lần trong mỗi 15 phút");
      const requestId = await createReanalysisRequest(ctx.user.id, input.snapshotId);
      try {
        const settings = await getNewsAiSettings(ctx.user.id);
        const news = snapshot.interval === "1h" ? await fetchRelevantNews(snapshot.symbol as SymbolName, Date.now(), { sources: JSON.parse(settings?.rssSources ?? "[]") as string[], lookbackHours: settings?.newsLookbackHours ?? 6 }) : [];
        const result = await invokeLLM({ messages: [{ role: "system", content: "Bạn là chuyên gia phân tích crypto. Viết bằng tiếng Việt, chỉ dùng dữ liệu được cung cấp, nêu bối cảnh, tín hiệu, rủi ro và điều kiện vô hiệu hóa. Không đưa ra cam kết lợi nhuận." }, { role: "user", content: `Phân tích lại tín hiệu cũ ${snapshot.symbol} ${snapshot.interval}. Giá ${snapshot.price}; Entry ${snapshot.entry}; TP1 ${snapshot.takeProfit1}; TP2 ${snapshot.takeProfit2}; SL ${snapshot.stopLoss}; chỉ báo ${snapshot.indicators}; tin tức: ${news.map(item => `${item.title} (${item.source}, ${new Date(item.publishedAt).toISOString()})`).join(" | ") || "không có tin"}` }], reasoning: { effort: "low" }});
        const analysis = responseText(result);
        await saveAiAnalysis(ctx.user.id, { snapshotId: snapshot.id, symbol: snapshot.symbol, interval: snapshot.interval, analysis });
        await updateReanalysisRequest(requestId, { status: "completed" });
        return { analysis, generatedAt: Date.now() };
      } catch (error) {
        await updateReanalysisRequest(requestId, { status: "failed", error: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    }),
    riskHistory: protectedProcedure.input(z.object({ exchange: z.string().min(1), symbol: z.string().min(1), interval: z.string().min(1), limit: z.number().min(2).max(60).default(24) })).query(({ ctx, input }) => getRiskHistory(ctx.user.id, input.exchange, input.symbol, input.interval, input.limit)),
    riskHistories: protectedProcedure.input(z.object({ limitPerKey: z.number().min(2).max(60).default(24) }).optional()).query(({ ctx, input }) => getRiskHistories(ctx.user.id, input?.limitPerKey ?? 24)),
    outcomeMetrics: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(40).default(20), exchange: z.enum(["Binance", "Bybit", "OKX"]).optional(), symbol: z.enum(["BTCUSDT", "ETHUSDT"]).optional(), interval: z.enum(["15m", "1h", "4h", "1d"]).optional() }).optional()).query(async ({ ctx, input }) => {
      const history = await getSignalHistory(ctx.user.id, input?.limit ?? 20);
      const filtered = history.filter(row => (!input?.exchange || row.exchange === input.exchange) && (!input?.symbol || row.symbol === input.symbol) && (!input?.interval || row.interval === input.interval));
      const groups = new Map<string, typeof filtered>();
      for (const row of filtered) {
        const groupKey = `${row.exchange}:${row.symbol}:${row.interval}`;
        groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
      }
      const outcomeGroups = await Promise.all(Array.from(groups.values()).map(async rows => {
        const first = rows[0];
        const candles = await fetchExchangeCandles(first.exchange as ExchangeName, first.symbol as SymbolName, first.interval as IntervalName, 300).catch(() => []);
        return Promise.all(rows.map(async row => {
          const outcome = evaluateSignalOutcome({ direction: row.label, entry: row.entry, takeProfit: row.takeProfit1, stopLoss: row.stopLoss, signalCandleOpenTime: (() => { try { return Number((JSON.parse(row.indicators) as { candleOpenTime?: number }).candleOpenTime ?? row.createdAt.getTime()); } catch { return row.createdAt.getTime(); } })() }, candles);
          await upsertSignalOutcome({ userId: ctx.user.id, snapshotId: row.id, exchange: row.exchange, symbol: row.symbol, interval: row.interval, outcome: outcome.result, signalCandleOpenTime: outcome.signalCandleOpenTime, exitCandleOpenTime: outcome.exitCandleOpenTime, exitPrice: outcome.exitPrice, returnPercent: outcome.returnPercent, candlesObserved: outcome.candlesObserved, reason: outcome.reason });
          return { ...outcome, id: row.id, exchange: row.exchange, symbol: row.symbol, interval: row.interval, createdAt: row.createdAt };
        }));
      }));
      const outcomes = outcomeGroups.flat();
      const baseConfidences = filtered.map(row => { try { return Number((JSON.parse(row.indicators) as { confidence?: number }).confidence ?? 50); } catch { return 50; } }).filter(Number.isFinite);
      const baseConfidence = baseConfidences.length ? baseConfidences.reduce((sum, value) => sum + value, 0) / baseConfidences.length : 50;
      const breakdown: Record<string, ReturnType<typeof summarizeOutcomes>> = {};
      for (const outcome of outcomes) {
        const key = `${outcome.exchange}:${outcome.symbol}:${outcome.interval}`;
        breakdown[key] = summarizeOutcomes([...(breakdown[key] ? [] : []), ...outcomes.filter(item => `${item.exchange}:${item.symbol}:${item.interval}` === key)]);
      }
      const persisted = await getSignalOutcomes(ctx.user.id, input?.limit ?? 20);
      return { summary: summarizeOutcomes(outcomes), breakdown, calibration: calibrateConfidence(baseConfidence, outcomes), outcomes, persistedCount: persisted.length, evaluatedAt: Date.now(), note: "Outcome được lưu theo snapshot. Snapshot ngoài cửa sổ nến fetch sẽ là invalid; cùng nến chạm TP/SL dùng giả định SL trước." };
    }),
  }),
  news: router({
    settings: protectedProcedure.query(async ({ ctx }) => {
      const row = await getNewsAiSettings(ctx.user.id);
      return row ? { ...row, rssSources: JSON.parse(row.rssSources) as string[], aiIntervals: JSON.parse(row.aiIntervals) as string[] } : { rssSources: ["https://www.coindesk.com/arc/outboundfeeds/rss/", "https://cryptobriefing.com/feed/"], newsLookbackHours: 6, aiIntervals: ["1h"], enabled: 1 };
    }),
    saveSettings: protectedProcedure.input(z.object({ rssSources: z.array(z.string().url()).min(1).max(10), newsLookbackHours: z.number().int().min(1).max(48), aiIntervals: z.array(z.enum(["15m", "1h", "4h", "1d"])).min(1).max(4), enabled: z.boolean() })).mutation(({ ctx, input }) => saveNewsAiSettings(ctx.user.id, { ...input, enabled: input.enabled ? 1 : 0 })),
    history: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(50), symbol: z.string().max(20).optional() }).optional()).query(({ ctx, input }) => getNewsHistory(ctx.user.id, input?.limit ?? 50, input?.symbol)),
    historyPage: protectedProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(50).default(20), symbol: z.string().max(20).optional() }).optional()).query(({ ctx, input }) => getNewsHistoryPage(ctx.user.id, input?.page ?? 1, input?.pageSize ?? 20, input?.symbol)),
    aiHistory: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(50), symbol: z.string().max(20).optional(), interval: z.enum(["15m", "1h", "4h", "1d"]).optional() }).optional()).query(({ ctx, input }) => getAiHistory(ctx.user.id, input?.limit ?? 50, { symbol: input?.symbol, interval: input?.interval })),
    aiHistoryPage: protectedProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(50).default(20), symbol: z.string().max(20).optional(), interval: z.enum(["15m", "1h", "4h", "1d"]).optional() }).optional()).query(({ ctx, input }) => getAiHistoryPage(ctx.user.id, input?.page ?? 1, input?.pageSize ?? 20, { symbol: input?.symbol, interval: input?.interval })),
  }),
  telegram: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getTelegramSettings(ctx.user.id);
      return settings ? { ...settings, botToken: settings.botToken.replace(/.(?=.{4})/g, "•") } : null;
    }),
    save: protectedProcedure.input(z.object({ botToken: z.string().min(10), chatId: z.string().min(1), alertThreshold: z.number().min(25).max(100), sendMode: z.enum(["all_candles", "strong_only"]).default("all_candles"), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
      const current = await getTelegramSettings(ctx.user.id);
      const token = input.botToken.includes("•") ? current?.botToken ?? "" : input.botToken;
      if (!token) throw new Error("Cần nhập Telegram Bot Token hợp lệ");
      let taskUid = current?.scheduleCronTaskUid ?? undefined;
      if (process.env.NODE_ENV === "production") {
        const session = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const jobDefinition = { cron: "0 * * * * *", path: "/api/scheduled/refresh-signals", method: "POST" as const, description: "Kiểm tra nến đã đóng và gửi cảnh báo Telegram mỗi phút" };
        if (!taskUid) {
          const job = await createHeartbeatJob({ name: `refresh-signals-${ctx.user.id}`, ...jobDefinition }, session);
          taskUid = job.taskUid;
        } else {
          await updateHeartbeatJob(taskUid, jobDefinition, session);
        }
      }
      return saveTelegramSettings(ctx.user.id, { botToken: token, chatId: input.chatId, alertThreshold: input.alertThreshold, sendMode: input.sendMode, enabled: input.enabled ? 1 : 0 }, taskUid);
    }),
    test: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await getTelegramSettings(ctx.user.id);
      if (!settings) throw new Error("Chưa có cấu hình Telegram");
      try {
        const result = await sendTelegramMessage(settings.botToken, settings.chatId, "<b>Crypto Trend Signal</b>\nKết nối Telegram thành công. Cảnh báo tự động đã sẵn sàng.");
        console.info(`[TelegramTest] user=${ctx.user.id} status=sent messageId=${result.result?.message_id ?? "unknown"}`);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[TelegramTest] user=${ctx.user.id} status=failed error=${message}`);
        throw error;
      }
    }),
    deliveryHistory: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(30), status: z.enum(["pending", "sent", "failed"]).optional(), symbol: z.string().optional(), exchange: z.string().optional(), interval: z.string().optional() }).optional()).query(({ ctx, input }) => getTelegramDeliveryHistory(ctx.user.id, input?.limit ?? 30, input)),
    heartbeatHistory: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(20), status: z.enum(["success", "failed"]).optional() }).optional()).query(({ ctx, input }) => getHeartbeatHistory(ctx.user.id, input?.limit ?? 20, input?.status)),
    deliveryHistoryPage: protectedProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(50).default(20), status: z.enum(["pending", "sent", "failed"]).optional(), symbol: z.string().optional(), exchange: z.string().optional(), interval: z.string().optional() }).optional()).query(({ ctx, input }) => getTelegramDeliveryHistoryPage(ctx.user.id, input?.page ?? 1, input?.pageSize ?? 20, input)),
    heartbeatHistoryPage: protectedProcedure.input(z.object({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(5).max(50).default(20), status: z.enum(["success", "failed"]).optional() }).optional()).query(({ ctx, input }) => getHeartbeatHistoryPage(ctx.user.id, input?.page ?? 1, input?.pageSize ?? 20, input?.status)),
    rules: protectedProcedure.query(({ ctx }) => getTelegramAlertRules(ctx.user.id)),
    saveRule: protectedProcedure.input(z.object({ id: z.number().int().positive().optional(), symbol: z.string().min(1).max(20), exchange: z.string().min(1).max(20), interval: z.string().min(1).max(10), alertThreshold: z.number().int().min(25).max(100), enabled: z.boolean() })).mutation(({ ctx, input }) => upsertTelegramAlertRule(ctx.user.id, { symbol: input.symbol, exchange: input.exchange, interval: input.interval, alertThreshold: input.alertThreshold, enabled: input.enabled ? 1 : 0 })),
    deleteRule: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await deleteTelegramAlertRule(ctx.user.id, input.id); return { ok: true }; }),
    retryDelivery: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const delivery = await getTelegramDeliveryLogById(ctx.user.id, input.id);
      if (!delivery) throw new Error("Không tìm thấy bản ghi delivery");
      if (delivery.status === "sent") return delivery;
      if (!delivery.message) throw new Error("Bản ghi cũ không có nội dung để gửi lại");
      const settings = await getTelegramSettings(ctx.user.id);
      if (!settings?.enabled || !settings.botToken || !settings.chatId) throw new Error("Telegram chưa được bật hoặc thiếu cấu hình");
      const attempts = delivery.attempts + 1;
      await updateTelegramDeliveryLog(delivery.id, { status: "pending", attempts, lastError: null });
      try {
        const result = await sendTelegramMessage(settings.botToken, settings.chatId, delivery.message);
        await updateTelegramDeliveryLog(delivery.id, { status: "sent", telegramMessageId: result.result?.message_id ? String(result.result.message_id) : null, lastError: null, sentAt: new Date() });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateTelegramDeliveryLog(delivery.id, { status: "failed", lastError: message });
        throw new Error(message);
      }
      return getTelegramDeliveryLogById(ctx.user.id, delivery.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
