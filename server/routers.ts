import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { createHeartbeatJob } from "./_core/heartbeat";
import { analyzeAllMarkets } from "./market/binance";
import { getLastSignal, getSignalHistory, getTelegramSettings, saveSignalSnapshot, saveTelegramSettings } from "./db";
import { formatSignalAlert, sendTelegramMessage } from "./services/telegram";

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
      for (const a of analyses) {
        const previous = await getLastSignal(ctx.user.id, a.exchange, a.symbol, a.interval);
        const settings = await getTelegramSettings(ctx.user.id);
        const changed = !previous || previous.label !== a.indicators.label;
        await saveSignalSnapshot({ userId: ctx.user.id, exchange: a.exchange, symbol: a.symbol, interval: a.interval, price: a.price, label: a.indicators.label, score: a.indicators.score, entry: a.levels.entry, takeProfit1: a.levels.takeProfit1, takeProfit2: a.levels.takeProfit2, stopLoss: a.levels.stopLoss, indicators: JSON.stringify(a.indicators) });
        if (settings?.enabled && Math.abs(a.indicators.score) >= settings.alertThreshold && changed && settings.botToken && settings.chatId) {
          await sendTelegramMessage(settings.botToken, settings.chatId, formatSignalAlert(a));
        }
      }
      return { saved: analyses.length, updatedAt: Date.now() };
    }),
    history: protectedProcedure.input(z.object({ limit: z.number().min(1).max(100).default(40) })).query(({ ctx, input }) => getSignalHistory(ctx.user.id, input.limit)),
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
      if (!taskUid && process.env.NODE_ENV === "production") {
        const session = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        const job = await createHeartbeatJob({ name: `refresh-signals-${ctx.user.id}`, cron: "0 */15 * * * *", path: "/api/scheduled/refresh-signals", description: "Làm mới tín hiệu BTC/ETH và gửi cảnh báo Telegram mỗi 15 phút" }, session);
        taskUid = job.taskUid;
      }
      return saveTelegramSettings(ctx.user.id, { botToken: token, chatId: input.chatId, alertThreshold: input.alertThreshold, enabled: input.enabled ? 1 : 0 }, taskUid);
    }),
    test: protectedProcedure.mutation(async ({ ctx }) => {
      const settings = await getTelegramSettings(ctx.user.id);
      if (!settings) throw new Error("Chưa có cấu hình Telegram");
      await sendTelegramMessage(settings.botToken, settings.chatId, "<b>Crypto Trend Signal</b>\nKết nối Telegram thành công. Cảnh báo tự động đã sẵn sàng.");
      return { ok: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
