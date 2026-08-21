import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { fetchAndAnalyzeMarket } from "./market-data";
import { ENV } from "./_core/env";

export const vercelAppRouter = router({
  auth: router({
    me: publicProcedure.query(() => null),
    logout: publicProcedure.mutation(() => ({ success: true as const })),
  }),
  signals: router({
    latest: publicProcedure.query(async () => {
      const stored = await db.getLatestSignalSnapshots();
      if (stored.length) return { source: "database" as const, signals: stored.map(row => row.snapshot) };
      return { source: "live" as const, signals: await fetchAndAnalyzeMarket() };
    }),
    history: publicProcedure.input(z.object({
      symbol: z.enum(["BTCUSDT", "ETHUSDT"]).optional(),
      timeframe: z.enum(["1m", "15m", "1h", "4h", "1d"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    })).query(({ input }) => db.getSignalHistory(input)),
    health: publicProcedure.query(async () => (await db.getMarketRefreshSetting()) ?? null),
  }),
  telegram: router({
    status: publicProcedure.query(() => ({
      configured: Boolean(ENV.telegramBotToken && ENV.telegramWebhookSecret),
      deploymentRequired: false,
    })),
  }),
});
