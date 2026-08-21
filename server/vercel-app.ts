import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { telegramWebhookHandler } from "./telegram";
import { registerVercelTelegramWebhook } from "./vercel-admin";
import { createVercelContext } from "./vercel-context";
import { vercelAppRouter } from "./vercel-router";
import { vercelMarketRefreshHandler } from "./vercel-scheduled";

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));

app.get("/api/cron/market-refresh", vercelMarketRefreshHandler);
app.post("/api/telegram/webhook", telegramWebhookHandler);
app.post("/api/admin/register-telegram", registerVercelTelegramWebhook);
app.use("/api/trpc", createExpressMiddleware({ router: vercelAppRouter, createContext: createVercelContext }));
app.get("/api/health", (_req, res) => res.status(200).json({ ok: true, runtime: "vercel" }));

export default app;
