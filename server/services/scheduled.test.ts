import { beforeEach, describe, expect, it, vi } from "vitest";
import { paperPnlReportHandler, refreshSignalsHandler } from "./scheduled";

const { authenticateRequest, getSettings, getPaperReportSettings, getClosedTrades, updatePaperReport, createAudit, getRules, getQualityOverrides, getLast, getProcessed, getDelivery, getSignalOutcomes, getMomentumSettings, getConfidenceHistory, getCriticalAlert, createCriticalAlert, updateCriticalAlert, createDelivery, updateDelivery, markProcessed, saveSnapshot, saveHeartbeat, analyze, send } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(), getSettings: vi.fn(), getPaperReportSettings: vi.fn(), getClosedTrades: vi.fn(), updatePaperReport: vi.fn(), createAudit: vi.fn(), getRules: vi.fn(), getQualityOverrides: vi.fn(), getLast: vi.fn(), getProcessed: vi.fn(), getDelivery: vi.fn(), getSignalOutcomes: vi.fn(), getMomentumSettings: vi.fn(), getConfidenceHistory: vi.fn(), getCriticalAlert: vi.fn(), createCriticalAlert: vi.fn(), updateCriticalAlert: vi.fn(), createDelivery: vi.fn(), updateDelivery: vi.fn(), markProcessed: vi.fn(), saveSnapshot: vi.fn(), saveHeartbeat: vi.fn(), analyze: vi.fn(), send: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("../db", () => ({ getTelegramSettingsByTaskUid: getSettings, getTelegramSettingsByPaperReportTaskUid: getPaperReportSettings, getClosedPaperTradesForDate: getClosedTrades, updatePaperReportSettings: updatePaperReport, createPaperBotAudit: createAudit, getTelegramAlertRules: getRules, getQualityThresholdOverrides: getQualityOverrides, getLastSignal: getLast, getProcessedCandle: getProcessed, getTelegramDeliveryLog: getDelivery, getSignalOutcomes, getMomentumSettings, getConfidenceHistory, getMomentumCriticalAlert: getCriticalAlert, createMomentumCriticalAlert: createCriticalAlert, updateMomentumCriticalAlert: updateCriticalAlert, getNewsAiSettings: vi.fn(async () => undefined), saveAiAnalysis: vi.fn(), saveNewsItem: vi.fn(), createTelegramDeliveryLog: createDelivery, updateTelegramDeliveryLog: updateDelivery, markProcessedCandle: markProcessed, saveSignalSnapshot: saveSnapshot, saveHeartbeatRun: saveHeartbeat }));
vi.mock("../market/binance", () => ({ analyzeAllMarkets: analyze }));
vi.mock("../market/news", () => ({ fetchRelevantNews: vi.fn(async () => []) }));
vi.mock("./telegram", () => ({ formatSignalAlert: vi.fn(() => "alert"), formatMomentumCriticalAlert: vi.fn(() => "critical alert"), generateSignalAiAnalysis: vi.fn(async () => "AI test analysis"), buildSignalInlineKeyboard: vi.fn(() => ({ inline_keyboard: [] })), sendTelegramMessage: send }));

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

const market = { exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, candleClosedAt: 4600, price: 100, indicators: { label: "Bullish", score: 75 }, levels: { entry: 99, takeProfit1: 105, takeProfit2: 110, stopLoss: 95 } } as any;

describe("paperPnlReportHandler", () => {
  beforeEach(() => { vi.clearAllMocks(); getQualityOverrides.mockResolvedValue([]); send.mockResolvedValue({ ok: true, result: { message_id: 9 } }); updatePaperReport.mockResolvedValue(undefined); createAudit.mockResolvedValue(undefined); });

  it("rejects non-cron callers", async () => {
    authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await paperPnlReportHandler({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a report for the previous UTC day and records the date", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "paper-task" });
    getPaperReportSettings.mockResolvedValue({ userId: 7, botToken: "token", chatId: "chat", paperReportEnabled: 1, paperReportLastDate: null });
    getClosedTrades.mockResolvedValue([{ symbol: "BTCUSDT", status: "take_profit", pnlPercent: 1.25, closedAt: Date.now() }]);
    const res = response();
    await paperPnlReportHandler({} as any, res);
    expect(send).toHaveBeenCalledWith("token", "chat", expect.stringContaining("Báo cáo P&L Sandbox"));
    expect(updatePaperReport).toHaveBeenCalledWith(7, expect.objectContaining({ lastDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(createAudit).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, trades: 1 }));
  });

  it("does not resend the same UTC date", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "paper-task" });
    const dateKey = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    getPaperReportSettings.mockResolvedValue({ userId: 7, botToken: "token", chatId: "chat", paperReportEnabled: 1, paperReportLastDate: dateKey });
    const res = response();
    await paperPnlReportHandler({} as any, res);
    expect(send).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "already-sent", dateKey });
  });
});

describe("refreshSignalsHandler", () => {
  beforeEach(() => { vi.clearAllMocks(); getRules.mockResolvedValue([]); getQualityOverrides.mockResolvedValue([]); getSignalOutcomes.mockResolvedValue([]); getMomentumSettings.mockResolvedValue({ criticalDropThreshold: 15, deterioratingDropThreshold: 8 }); getConfidenceHistory.mockResolvedValue([]); getCriticalAlert.mockResolvedValue(undefined); createCriticalAlert.mockResolvedValue({ id: 2, status: "pending", attempts: 0, message: "critical alert" }); analyze.mockResolvedValue([market]); getDelivery.mockResolvedValue(undefined); createDelivery.mockResolvedValue({ id: 1, status: "pending", attempts: 0 }); saveSnapshot.mockResolvedValue(undefined); updateDelivery.mockResolvedValue(undefined); updateCriticalAlert.mockResolvedValue(undefined); saveHeartbeat.mockResolvedValue(undefined); send.mockResolvedValue({ ok: true, result: { message_id: 1 } }); });

  it("rejects non-cron callers", async () => {
    authenticateRequest.mockResolvedValue({ isCron: false });
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(analyze).not.toHaveBeenCalled();
  });

  it("returns skipped for an orphan task", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "missing" });
    getSettings.mockResolvedValue(undefined);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(res.json).toHaveBeenCalledWith({ ok: true, skipped: "orphan" });
  });

  it("skips an already processed closed candle", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue({ candleOpenTime: 1000 });
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ saved: 0, alerts: 0 }));
  });

  it("saves signals and alerts for every new closed candle", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, botToken: "token", chatId: "chat" });
    getLast.mockResolvedValue({ label: "Bearish" });
    getProcessed.mockResolvedValue(undefined);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(saveSnapshot).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, saved: 1, alerts: 1 }));
  });

  it("alerts even when the signal is No Trade, weak, or liquidity-invalid", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 90, botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue(undefined);
    analyze.mockResolvedValue([{ ...market, indicators: { label: "Neutral", score: 3 }, signalStatus: "No Trade", signalReason: "Khung thời gian xung đột", liquidity: { isValid: false, warnings: ["Spread cao"] } }]);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(send).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alerts: 1 }));
  });

  it("skips a weak or No Trade candle in strong_only mode but marks it processed", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, sendMode: "strong_only", botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue(undefined);
    analyze.mockResolvedValue([{ ...market, indicators: { label: "Neutral", score: 49 }, signalStatus: "No Trade", liquidity: { isValid: true } }]);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(send).not.toHaveBeenCalled();
    expect(markProcessed).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alerts: 0, saved: 1 }));
  });

  it("sends a quality warning in strong_only mode when confidence is sharply reduced", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, sendMode: "strong_only", botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue(undefined);
    analyze.mockResolvedValue([{ ...market, indicators: { label: "Neutral", score: 10, confidence: 42 }, signalStatus: "No Trade", liquidity: { isValid: false }, signalQuality: { penalty: 24, isTradeEligible: false, reasons: ["Thanh khoản chưa đạt"] } }]);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(send).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alerts: 1 }));
  });

  it("uses an exchange override before the global quality threshold", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, qualityAlertThreshold: 20, sendMode: "strong_only", botToken: "token", chatId: "chat" });
    getQualityOverrides.mockResolvedValue([{ exchange: "Binance", threshold: 30 }]);
    getProcessed.mockResolvedValue(undefined);
    analyze.mockResolvedValue([{ ...market, indicators: { label: "Neutral", score: 10, confidence: 42 }, signalStatus: "No Trade", liquidity: { isValid: false }, signalQuality: { penalty: 24, isTradeEligible: false, reasons: ["Thanh khoản chưa đạt"] } }]);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(send).not.toHaveBeenCalled();
    expect(markProcessed).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alerts: 0 }));
  });

  it("records a failed delivery without marking the candle, so the next Heartbeat can retry", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, botToken: "token", chatId: "chat" });
    getLast.mockResolvedValue({ label: "Bearish" });
    getProcessed.mockResolvedValue(undefined);
    send.mockRejectedValueOnce(new Error("Telegram trả về HTTP 400: chat not found"));
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(updateDelivery).toHaveBeenNthCalledWith(1, 1, expect.objectContaining({ status: "pending", attempts: 1 }));
    expect(updateDelivery).toHaveBeenLastCalledWith(1, expect.objectContaining({ status: "failed", lastError: expect.stringContaining("chat not found") }));
    expect(markProcessed).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alerts: 0 }));
  });

  it("retries an existing failed delivery and marks the candle after success", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue(undefined);
    getDelivery.mockResolvedValue({ id: 1, status: "failed", attempts: 1 });
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
    expect(markProcessed).toHaveBeenCalledOnce();
    expect(updateDelivery).toHaveBeenLastCalledWith(1, expect.objectContaining({ status: "sent" }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ alerts: 1 }));
  });

  it("sends a separate Telegram alert when momentum transitions into Critical", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue(undefined);
    getConfidenceHistory.mockResolvedValue([{ candleClosedAt: 1000, confidence: 78, penalty: 0, isTradeEligible: true, label: "Bullish" }, { candleClosedAt: 3000, confidence: 74, penalty: 1, isTradeEligible: true, label: "Bullish" }]);
    analyze.mockResolvedValue([{ ...market, indicators: { label: "Neutral", score: 10, confidence: 55 }, signalQuality: { penalty: 24, isTradeEligible: false, reasons: ["Thanh khoản chưa đạt"] } }]);
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(createCriticalAlert).toHaveBeenCalledOnce();
    expect(updateCriticalAlert).toHaveBeenLastCalledWith(2, expect.objectContaining({ status: "sent" }));
    expect(send).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ criticalAlerts: 1 }));
  });

  it("retries a failed Critical alert after the candle is processed without saving another snapshot", async () => {
    authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-1" });
    getSettings.mockResolvedValue({ userId: 7, enabled: 1, alertThreshold: 50, botToken: "token", chatId: "chat" });
    getProcessed.mockResolvedValue({ candleOpenTime: 1000 });
    getCriticalAlert.mockResolvedValue({ id: 2, status: "failed", attempts: 1, message: "critical alert" });
    const res = response();
    await refreshSignalsHandler({} as any, res);
    expect(saveSnapshot).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledOnce();
    expect(updateCriticalAlert).toHaveBeenLastCalledWith(2, expect.objectContaining({ status: "sent" }));
  });
});
