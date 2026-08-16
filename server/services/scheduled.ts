import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import {
  createTelegramDeliveryLog,
  getLastSignal,
  getProcessedCandle,
  getTelegramDeliveryLog,
  getTelegramSettingsByTaskUid,
  getTelegramAlertRules,
  markProcessedCandle,
  saveHeartbeatRun,
  saveSignalSnapshot,
  updateTelegramDeliveryLog,
} from "../db";
import { analyzeAllMarkets } from "../market/binance";
import { formatSignalAlert, sendTelegramMessage } from "./telegram";
import { resolveAlertRule } from "./alertRules";

export async function refreshSignalsHandler(req: Request, res: Response) {
  const startedAt = new Date();
  const startedMs = startedAt.getTime();
  let userId: number | undefined;
  let taskUid: string | undefined;
  let saved = 0;
  let alerts = 0;
  let skipped = 0;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const settings = await getTelegramSettingsByTaskUid(taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    userId = settings.userId;
    const rules = await getTelegramAlertRules(userId);
    const analyses = await analyzeAllMarkets();

    for (const a of analyses) {
      const key = { exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime };
      const alertSettings = resolveAlertRule(settings, rules, { exchange: a.exchange, symbol: a.symbol, interval: a.interval });
      const delivery = await getTelegramDeliveryLog(userId, key);
      const processed = await getProcessedCandle(userId, a.exchange, a.symbol, a.interval);
      const newClosedCandle = !processed || processed.candleOpenTime < a.candleOpenTime;
      const pendingDelivery = delivery && delivery.status !== "sent";
      if (!newClosedCandle && !pendingDelivery) { skipped++; continue; }

      let currentDelivery = delivery;
      if (!currentDelivery) {
        const previous = await getLastSignal(userId, a.exchange, a.symbol, a.interval);
          const shouldAlert = Boolean(alertSettings.enabled && Math.abs(a.indicators.score) >= alertSettings.alertThreshold && (!previous || previous.label !== a.indicators.label) && alertSettings.botToken && alertSettings.chatId);
        await saveSignalSnapshot({ userId, exchange: a.exchange, symbol: a.symbol, interval: a.interval, label: a.indicators.label, score: a.indicators.score, price: a.price, entry: a.levels.entry, takeProfit1: a.levels.takeProfit1, takeProfit2: a.levels.takeProfit2, stopLoss: a.levels.stopLoss, indicators: JSON.stringify({ ...a.indicators, risk: a.risk, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt }) });
        saved++;
        if (shouldAlert) {
            currentDelivery = await createTelegramDeliveryLog({ userId, taskUid, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt, label: a.indicators.label, score: a.indicators.score, message: formatSignalAlert(a) });
        } else {
          await markProcessedCandle({ userId, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime });
          continue;
        }
      }

      if (!currentDelivery || currentDelivery.status === "sent") {
        await markProcessedCandle({ userId, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime });
        continue;
      }
      if (!alertSettings.enabled || !alertSettings.botToken || !alertSettings.chatId) { skipped++; continue; }

      const attempts = currentDelivery.attempts + 1;
      await updateTelegramDeliveryLog(currentDelivery.id, { status: "pending", attempts, lastError: null });
      try {
        const result = await sendTelegramMessage(alertSettings.botToken, alertSettings.chatId, currentDelivery.message ?? formatSignalAlert(a));
        await updateTelegramDeliveryLog(currentDelivery.id, { status: "sent", telegramMessageId: result.result?.message_id ? String(result.result.message_id) : null, lastError: null, sentAt: new Date() });
        await markProcessedCandle({ userId, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime });
        alerts++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await updateTelegramDeliveryLog(currentDelivery.id, { status: "failed", lastError: message });
      }
    }

    const durationMs = Date.now() - startedMs;
    await saveHeartbeatRun({ userId, taskUid, status: "success", savedCount: saved, alertCount: alerts, skippedCount: skipped, durationMs, startedAt, finishedAt: new Date() });
    return res.json({ ok: true, saved, alerts, skipped, durationMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (userId && taskUid) {
      await saveHeartbeatRun({ userId, taskUid, status: "failed", savedCount: saved, alertCount: alerts, skippedCount: skipped, durationMs: Date.now() - startedMs, error: message, startedAt, finishedAt: new Date() }).catch(() => undefined);
    }
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
