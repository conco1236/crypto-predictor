import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getLastSignal, getTelegramSettingsByTaskUid, saveSignalSnapshot } from "../db";
import { analyzeAllMarkets } from "../market/binance";
import { formatSignalAlert, sendTelegramMessage } from "./telegram";

export async function refreshSignalsHandler(req: Request, res: Response) {
  const startedAt = Date.now();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const settings = await getTelegramSettingsByTaskUid(user.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const analyses = await analyzeAllMarkets();
    let alerts = 0;
    for (const a of analyses) {
      const previous = await getLastSignal(settings.userId, a.symbol, a.interval);
      const shouldAlert = Boolean(settings.enabled && Math.abs(a.indicators.score) >= settings.alertThreshold && (!previous || previous.label !== a.indicators.label));
      await saveSignalSnapshot({ userId: settings.userId, symbol: a.symbol, interval: a.interval, label: a.indicators.label, score: a.indicators.score, price: a.price, entry: a.levels.entry, takeProfit1: a.levels.takeProfit1, takeProfit2: a.levels.takeProfit2, stopLoss: a.levels.stopLoss, indicators: JSON.stringify(a.indicators) });
      if (shouldAlert) { await sendTelegramMessage(settings.botToken, settings.chatId, formatSignalAlert(a)); alerts++; }
    }
    return res.json({ ok: true, saved: analyses.length, alerts, durationMs: Date.now() - startedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
