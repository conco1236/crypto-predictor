import type { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import {
  createTelegramDeliveryLog,
  createMomentumCriticalAlert,
  getConfidenceHistory,
  getLastSignal,
  getMomentumCriticalAlert,
  getMomentumSettings,
  getTechnicalAiSettings,
  getProcessedCandle,
  getSignalOutcomes,
  getTelegramDeliveryLog,
  getTelegramSettingsByTaskUid,
  getTelegramAlertRules,
  getNewsAiSettings,
  getQualityThresholdOverrides,
  markProcessedCandle,
  saveAiAnalysis,
  saveHeartbeatRun,
  saveNewsItem,
  saveSignalSnapshot,
  updateMomentumCriticalAlert,
  updateTelegramDeliveryLog,
  updateTechnicalAiQuotaAlertState,
  getTelegramSettingsByPaperReportTaskUid,
  getClosedPaperTradesForDate,
  updatePaperReportSettings,
  createPaperBotAudit,
} from "../db";
import { analyzeAllMarkets } from "../market/binance";
import { fetchRelevantNews } from "../market/news";
import { calibrateConfidence } from "../market/outcomes";
import { buildMomentumCriticalInlineKeyboard, buildSignalInlineKeyboard, formatMomentumCriticalAlert, formatSignalAlert, generateSignalAiAnalysis, sendTelegramMessage } from "./telegram";
import { resolveAlertRule } from "./alertRules";
import { resolveQualityThreshold } from "./qualityThresholds";
import { detectCriticalMomentumTransition } from "../../shared/confidenceMomentum";
import { testManualTechnicalAiConnection } from "./technicalAi";
import { processTechnicalAiQuotaAlert } from "./technicalAiQuotaAlerts";

function utcDateKey(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function formatDailyPaperPnl(dateKey: string, trades: Awaited<ReturnType<typeof getClosedPaperTradesForDate>>) {
  const groups = new Map<string, { count: number; pnl: number; wins: number; losses: number }>();
  for (const trade of trades) {
    const symbol = trade.symbol.replace(/USDT$/, "");
    const row = groups.get(symbol) ?? { count: 0, pnl: 0, wins: 0, losses: 0 };
    row.count += 1; row.pnl += Number(trade.pnlPercent ?? 0);
    if (trade.status === "take_profit") row.wins += 1;
    if (trade.status === "stop_loss") row.losses += 1;
    groups.set(symbol, row);
  }
  const lines = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([asset, row]) => `${asset}: ${row.count} lệnh · P&L ${row.pnl >= 0 ? "+" : ""}${row.pnl.toFixed(3)}% · TP ${row.wins} · SL ${row.losses}`);
  const total = trades.reduce((sum, trade) => sum + Number(trade.pnlPercent ?? 0), 0);
  return `<b>Báo cáo P&L Sandbox — ${dateKey} UTC</b>\nTổng lệnh đóng: ${trades.length}\nTổng P&L: <b>${total >= 0 ? "+" : ""}${total.toFixed(3)}%</b>\n${lines.length ? lines.join("\n") : "Chưa có lệnh sandbox đóng trong ngày."}\n\nChỉ là mô phỏng, không có lệnh live.`;
}

export async function paperPnlReportHandler(req: Request, res: Response) {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const settings = await getTelegramSettingsByPaperReportTaskUid(taskUid);
    if (!settings || settings.paperReportEnabled !== 1) return res.json({ ok: true, skipped: "disabled-or-orphan" });
    const dateKey = utcDateKey(-1);
    if (settings.paperReportLastDate === dateKey) return res.json({ ok: true, skipped: "already-sent", dateKey });
    const trades = await getClosedPaperTradesForDate(settings.userId, dateKey);
    const message = formatDailyPaperPnl(dateKey, trades);
    const result = await sendTelegramMessage(settings.botToken, settings.chatId, message);
    if (!result.ok) throw new Error(result.description ?? "Telegram report failed");
    await updatePaperReportSettings(settings.userId, { lastDate: dateKey });
    await createPaperBotAudit(settings.userId, "daily_pnl_report", `Đã gửi báo cáo P&L sandbox ngày ${dateKey}; ${trades.length} lệnh`);
    return res.json({ ok: true, dateKey, trades: trades.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: message, taskUid, timestamp: new Date().toISOString() });
  }
}

export async function refreshSignalsHandler(req: Request, res: Response) {
  const startedAt = new Date();
  const startedMs = startedAt.getTime();
  let userId: number | undefined;
  let taskUid: string | undefined;
  let saved = 0;
  let alerts = 0;
  let criticalAlerts = 0;
  let quotaAlerts = 0;
  let skipped = 0;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    taskUid = user.taskUid;
    const settings = await getTelegramSettingsByTaskUid(taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    userId = settings.userId;
    const rules = await getTelegramAlertRules(userId);
    const qualityOverrides = await getQualityThresholdOverrides(userId);
    const momentumSettings = await getMomentumSettings(userId);
    const technicalAiSettings = await getTechnicalAiSettings(userId);
    const newsSettings = await getNewsAiSettings(userId);
    const persistedOutcomes = await getSignalOutcomes(userId, 200);
    const analyses = await analyzeAllMarkets();

    const lastQuotaCheck = technicalAiSettings.quotaCheckLastAt ? new Date(technicalAiSettings.quotaCheckLastAt).getTime() : 0;
    if (technicalAiSettings.mode === "manual_api" && Date.now() - lastQuotaCheck >= 60 * 60_000) {
      try {
        const quotaProbe = await testManualTechnicalAiConnection(userId);
        const quotaResult = await processTechnicalAiQuotaAlert(userId, quotaProbe.quota);
        if (quotaResult.sent) { alerts++; quotaAlerts++; }
      } catch {
        await updateTechnicalAiQuotaAlertState(userId, { state: "unavailable", deliveryStatus: "pending", checkedAt: new Date() });
      }
    }

    for (const a of analyses) {
      const key = { exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime };
      const alertSettings = resolveAlertRule(settings, rules, { exchange: a.exchange, symbol: a.symbol, interval: a.interval });
      const delivery = await getTelegramDeliveryLog(userId, key);
      const criticalAlert = await getMomentumCriticalAlert(userId, key);
      const processed = await getProcessedCandle(userId, a.exchange, a.symbol, a.interval);
      const newClosedCandle = !processed || processed.candleOpenTime < a.candleOpenTime;
      const pendingDelivery = delivery && delivery.status !== "sent";
      const pendingCriticalAlert = criticalAlert && criticalAlert.status !== "sent";
      if (!newClosedCandle && !pendingDelivery && !pendingCriticalAlert) { skipped++; continue; }

      let currentDelivery = delivery;
      let currentCriticalAlert = criticalAlert;
      if (!currentDelivery && newClosedCandle) {
          const strongSignal = (a.signalStatus ?? "Trade") === "Trade" && (a.liquidity?.isValid ?? true) && Math.abs(a.indicators.score) >= alertSettings.alertThreshold;
          const qualityAlert = (a.signalQuality?.penalty ?? 0) >= resolveQualityThreshold(a.exchange, alertSettings.qualityAlertThreshold ?? 20, qualityOverrides);
          const modeAllowsAlert = (alertSettings.sendMode ?? "all_candles") === "all_candles" || strongSignal || qualityAlert;
          const shouldAlert = Boolean(alertSettings.enabled && alertSettings.botToken && alertSettings.chatId && modeAllowsAlert);
        const priorConfidence = await getConfidenceHistory(userId, a.exchange, a.symbol, a.interval, 2);
        await saveSignalSnapshot({ userId, exchange: a.exchange, symbol: a.symbol, interval: a.interval, label: a.indicators.label, score: a.indicators.score, price: a.price, entry: a.levels.entry, takeProfit1: a.levels.takeProfit1, takeProfit2: a.levels.takeProfit2, stopLoss: a.levels.stopLoss, indicators: JSON.stringify({ ...a.indicators, risk: a.risk, signalQuality: a.signalQuality, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt }) });
        saved++;
        const currentConfidence = { candleClosedAt: a.candleClosedAt, confidence: Number(a.indicators.confidence ?? 0), penalty: a.signalQuality?.penalty ?? null, isTradeEligible: a.signalQuality?.isTradeEligible ?? null, label: a.indicators.label } as const;
        const momentumTransition = detectCriticalMomentumTransition(priorConfidence, currentConfidence, momentumSettings);
        if (momentumTransition.transitioned && alertSettings.enabled && alertSettings.botToken && alertSettings.chatId) {
          currentCriticalAlert = await createMomentumCriticalAlert({ userId, taskUid, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt, previousConfidence: momentumTransition.previous.latest?.confidence ?? null, confidence: currentConfidence.confidence, delta: momentumTransition.next.recentDelta, reason: momentumTransition.next.reason, message: formatMomentumCriticalAlert({ exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleClosedAt: a.candleClosedAt, previousConfidence: momentumTransition.previous.latest?.confidence ?? null, confidence: currentConfidence.confidence, delta: momentumTransition.next.recentDelta, reason: momentumTransition.next.reason, penalty: currentConfidence.penalty, isTradeEligible: currentConfidence.isTradeEligible }) });
        }
        if (shouldAlert) {
            const calibrated = calibrateConfidence(a.indicators.confidence, persistedOutcomes.map(row => ({ direction: a.indicators.label, signalCandleOpenTime: row.signalCandleOpenTime, result: row.outcome, exitCandleOpenTime: row.exitCandleOpenTime ?? undefined, exitPrice: row.exitPrice ?? undefined, returnPercent: row.returnPercent, candlesObserved: row.candlesObserved, reason: row.reason ?? "" })));
            const calibratedAnalysis = { ...a, indicators: { ...a.indicators, confidence: calibrated.confidence } };
            const configuredIntervals = newsSettings ? (JSON.parse(newsSettings.aiIntervals) as string[]) : ["1h"];
            const aiEnabled = newsSettings?.enabled !== 0 && configuredIntervals.includes(a.interval);
            const news = aiEnabled && a.interval === "1h" ? await fetchRelevantNews(a.symbol, Date.now(), { sources: JSON.parse(newsSettings?.rssSources ?? "[]") as string[], lookbackHours: newsSettings?.newsLookbackHours ?? 6 }) : [];
            for (const item of news) await saveNewsItem(userId, { symbol: a.symbol, source: item.source, url: item.url, title: item.title, summary: item.summary, publishedAt: item.publishedAt });
            const aiAnalysis = aiEnabled ? await generateSignalAiAnalysis(userId, calibratedAnalysis, news) : "Phân tích AI đã tắt trong cài đặt người dùng; tín hiệu kỹ thuật vẫn được lưu.";
            await saveAiAnalysis(userId, { symbol: a.symbol, interval: a.interval, analysis: aiAnalysis });
            currentDelivery = await createTelegramDeliveryLog({ userId, taskUid, exchange: a.exchange, symbol: a.symbol, interval: a.interval, candleOpenTime: a.candleOpenTime, candleClosedAt: a.candleClosedAt, label: a.indicators.label, score: a.indicators.score, message: formatSignalAlert(calibratedAnalysis, aiAnalysis, news) });
        } else {
          currentDelivery = undefined;
        }
      }

      if (currentCriticalAlert && currentCriticalAlert.status !== "sent") {
        const attempts = currentCriticalAlert.attempts + 1;
        await updateMomentumCriticalAlert(currentCriticalAlert.id, { status: "pending", attempts, lastError: null });
        try {
          const result = await sendTelegramMessage(alertSettings.botToken, alertSettings.chatId, currentCriticalAlert.message ?? "<b>⚠️ Momentum Critical</b>", buildMomentumCriticalInlineKeyboard({ exchange: a.exchange, symbol: a.symbol, interval: a.interval, targetCandleClosedAt: currentCriticalAlert.candleClosedAt }));
          await updateMomentumCriticalAlert(currentCriticalAlert.id, { status: "sent", telegramMessageId: result.result?.message_id ? String(result.result.message_id) : null, lastError: null, sentAt: new Date() });
          alerts++; criticalAlerts++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await updateMomentumCriticalAlert(currentCriticalAlert.id, { status: "failed", lastError: message });
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
        const result = await sendTelegramMessage(alertSettings.botToken, alertSettings.chatId, currentDelivery.message ?? formatSignalAlert({ ...a, indicators: { ...a.indicators, confidence: calibrateConfidence(a.indicators.confidence, persistedOutcomes.map(row => ({ direction: a.indicators.label, signalCandleOpenTime: row.signalCandleOpenTime, result: row.outcome, exitCandleOpenTime: row.exitCandleOpenTime ?? undefined, exitPrice: row.exitPrice ?? undefined, returnPercent: row.returnPercent, candlesObserved: row.candlesObserved, reason: row.reason ?? "" }))).confidence } }, "AI không khả dụng cho delivery cũ; dùng nội dung kỹ thuật đã lưu."), buildSignalInlineKeyboard(a));
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
    return res.json({ ok: true, saved, alerts, criticalAlerts, quotaAlerts, skipped, durationMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (userId && taskUid) {
      await saveHeartbeatRun({ userId, taskUid, status: "failed", savedCount: saved, alertCount: alerts, skippedCount: skipped, durationMs: Date.now() - startedMs, error: message, startedAt, finishedAt: new Date() }).catch(() => undefined);
    }
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}
