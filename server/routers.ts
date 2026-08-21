import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { createHeartbeatJob } from "./_core/heartbeat";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { fetchAndAnalyzeMarket } from "./market-data";
import { refreshMarketSignals } from "./signal-service";
import { configureTelegramWebhook } from "./telegram";
import { ENV } from "./_core/env";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  signals: router({
    latest: publicProcedure.query(async () => {
      const stored = await db.getLatestSignalSnapshots();
      if (stored.length) return { source: "database" as const, signals: stored.map(row => row.snapshot) };
      const signals = await fetchAndAnalyzeMarket();
      return { source: "live" as const, signals };
    }),
    history: publicProcedure.input(z.object({
      symbol: z.enum(["BTCUSDT", "ETHUSDT"]).optional(),
      timeframe: z.enum(["1m", "15m", "1h", "4h", "1d"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    })).query(({ input }) => db.getSignalHistory(input)),
    health: publicProcedure.query(async () => (await db.getMarketRefreshSetting()) ?? null),
    refreshNow: adminProcedure.mutation(() => refreshMarketSignals()),
  }),
  automation: router({
    enableMinuteRefresh: adminProcedure.mutation(async ({ ctx }) => {
      const existing = await db.getMarketRefreshSetting();
      if (existing?.scheduleCronTaskUid) return { taskUid: existing.scheduleCronTaskUid, existing: true };
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob({
        name: "crypto-market-refresh",
        cron: "0 * * * * *",
        path: "/api/scheduled/market-refresh",
        description: "Refresh BTCUSDT and ETHUSDT closed-candle technical signals every minute.",
      }, sessionToken);
      await db.markMarketRefresh({ status: "success", count: 0, scheduleCronTaskUid: job.taskUid });
      return { taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt, existing: false };
    }),
  }),
  telegram: router({
    status: publicProcedure.query(() => ({
      configured: Boolean(ENV.telegramBotToken && ENV.telegramWebhookSecret),
      deploymentRequired: !ENV.isProduction,
    })),
    configureWebhook: adminProcedure.mutation(({ ctx }) => configureTelegramWebhook(ctx.req)),
  }),
});

export type AppRouter = typeof appRouter;
