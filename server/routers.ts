import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob, updateHeartbeatJob } from "./_core/heartbeat";
import { analyzeAllMarkets } from "./market/binance";
import { createTelegramDeliveryLog, deleteTelegramAlertRule, getHeartbeatHistory, getHeartbeatHistoryPage, getLastSignal, getProcessedCandle, getRiskHistories, getRiskHistory, getSignalHistory, getTelegramAlertRules, getTelegramDeliveryHistory, getTelegramDeliveryHistoryPage, getTelegramDeliveryLog, getTelegramDeliveryLogById, getTelegramSettings, markProcessedCandle, saveSignalSnapshot, saveTelegramSettings, updateTelegramDeliveryLog, upsertTelegramAlertRule } from "./db";
import { formatSignalAlert, sendTelegramMessage } from "./services/telegram";
import { resolveAlertRule } from "./services/alertRules";

function responseText(response: Awaited<ReturnType<typeof invokeLLM>>) {
  const content = response.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : JSON.stringify(content ?? "");
}

const analysisInput = z.array(z.object({
  exchange: z.string(), symbol: z.string(), interval: z.string(), price: z.number(), label: z.string(), score: z.number(),
  rsi: z.number(), adx: z.number(), atr: z.number(), volumeRatio: z.number(), entry: z.number(), takeProfit1: z.number(), stopLoss: z.number(), reasons: z.array(z.string()),
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
      const compact = input.map(item => `${item.exchange} — ${item.symbol} ${item.interval}: ${item.label} score ${item.score}, giá ${item.price}, RSI ${item.rsi.toFixed(1)}, ADX ${item.adx.toFixed(1)}, ATR ${item.atr.toFixed(2)}, volume x${item.volumeRatio.toFixed(2)}, Entry ${item.entry.toFixed(2)}, TP ${item.takeProfit1.toFixed(2)}, SL ${item.stopLoss.toFixed(2)}; ${item.reasons.join(", ")}`).join("\n");
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
      const rules = await getTelegramAlertRules(ctx.user.id);
      let saved = 0;
      let alerts = 0;
      for (const a of analyses) {
        const processed = await getProcessedCandle(ctx.user.id, a.exchange, a.symbol, a.interval);
        if (processed && processed.candleOpenTime >= a.candleOpenTime) continue;
        const previous = await getLastSignal(ctx.user.id, a.exchange, a.symbol, a.interval);
        const alertSettings = settings ? resolveAlertRule(settings, rules, { exchange: a.exchange, symbol: a.symbol, interval: a.interval }) : undefined;
        const changed = !previous || previous.label !== a.indicators.label;
        await saveSignalSnapshot({ userId: ctx.user.id, exchange: a.exchange, symbol: a.symbol, interval: a.interval, price: a.price, label: a.indicators.label, score: a.indicators.score, entry: a.levels.entry, takeProfit1: a.levels.takeProfit1, takeProfit2: a.levels.takeProfit2, stopLoss: a.levels.stopLoss, indicators: JSON.stringify({ ...a.indicators, risk: a.risk, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt }) });
        saved++;
        const shouldAlert = Boolean(alertSettings?.enabled && Math.abs(a.indicators.score) >= alertSettings.alertThreshold && changed && alertSettings.botToken && alertSettings.chatId);
        if (!shouldAlert) {
          await markProcessedCandle({ userId: ctx.user.id, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime });
          continue;
        }
        const message = formatSignalAlert(a);
        const delivery = await createTelegramDeliveryLog({ userId: ctx.user.id, exchange: a.exchange, interval: a.interval, symbol: a.symbol, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt, label: a.indicators.label, score: a.indicators.score, message });
        const attempts = delivery?.attempts ?? 0;
        await updateTelegramDeliveryLog(delivery!.id, { status: "pending", attempts: attempts + 1, lastError: null });
        try {
          const result = await sendTelegramMessage(alertSettings!.botToken, alertSettings!.chatId, message);
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
    history: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(40) })).query(({ ctx, input }) => getSignalHistory(ctx.user.id, input.limit)),
    riskHistory: protectedProcedure.input(z.object({ exchange: z.string().min(1), symbol: z.string().min(1), interval: z.string().min(1), limit: z.number().min(2).max(60).default(24) })).query(({ ctx, input }) => getRiskHistory(ctx.user.id, input.exchange, input.symbol, input.interval, input.limit)),
    riskHistories: protectedProcedure.input(z.object({ limitPerKey: z.number().min(2).max(60).default(24) }).optional()).query(({ ctx, input }) => getRiskHistories(ctx.user.id, input?.limitPerKey ?? 24)),
  }),
  telegram: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getTelegramSettings(ctx.user.id);
      return settings ? { ...settings, botToken: settings.botToken.replace(/.(?=.{4})/g, "•") } : null;
    }),
    save: protectedProcedure.input(z.object({ botToken: z.string().min(10), chatId: z.string().min(1), alertThreshold: z.number().min(25).max(100), enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
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
      return saveTelegramSettings(ctx.user.id, { botToken: token, chatId: input.chatId, alertThreshold: input.alertThreshold, enabled: input.enabled ? 1 : 0 }, taskUid);
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
