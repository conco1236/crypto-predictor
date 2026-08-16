import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshSignalsHandler } from "./scheduled";

const { authenticateRequest, getSettings, getRules, getLast, getProcessed, getDelivery, getSignalOutcomes, createDelivery, updateDelivery, markProcessed, saveSnapshot, saveHeartbeat, analyze, send } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(), getSettings: vi.fn(), getRules: vi.fn(), getLast: vi.fn(), getProcessed: vi.fn(), getDelivery: vi.fn(), getSignalOutcomes: vi.fn(), createDelivery: vi.fn(), updateDelivery: vi.fn(), markProcessed: vi.fn(), saveSnapshot: vi.fn(), saveHeartbeat: vi.fn(), analyze: vi.fn(), send: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({ sdk: { authenticateRequest } }));
vi.mock("../db", () => ({ getTelegramSettingsByTaskUid: getSettings, getTelegramAlertRules: getRules, getLastSignal: getLast, getProcessedCandle: getProcessed, getTelegramDeliveryLog: getDelivery, getSignalOutcomes, createTelegramDeliveryLog: createDelivery, updateTelegramDeliveryLog: updateDelivery, markProcessedCandle: markProcessed, saveSignalSnapshot: saveSnapshot, saveHeartbeatRun: saveHeartbeat }));
vi.mock("../market/binance", () => ({ analyzeAllMarkets: analyze }));
vi.mock("../market/news", () => ({ fetchRelevantNews: vi.fn(async () => []) }));
vi.mock("./telegram", () => ({ formatSignalAlert: vi.fn(() => "alert"), generateSignalAiAnalysis: vi.fn(async () => "AI test analysis"), buildSignalInlineKeyboard: vi.fn(() => ({ inline_keyboard: [] })), sendTelegramMessage: send }));

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
}

const market = { exchange: "Binance", symbol: "BTCUSDT", interval: "1h", candleOpenTime: 1000, candleClosedAt: 4600, price: 100, indicators: { label: "Bullish", score: 75 }, levels: { entry: 99, takeProfit1: 105, takeProfit2: 110, stopLoss: 95 } } as any;

describe("refreshSignalsHandler", () => {
  beforeEach(() => { vi.clearAllMocks(); getRules.mockResolvedValue([]); getSignalOutcomes.mockResolvedValue([]); analyze.mockResolvedValue([market]); getDelivery.mockResolvedValue(undefined); createDelivery.mockResolvedValue({ id: 1, status: "pending", attempts: 0 }); saveSnapshot.mockResolvedValue(undefined); updateDelivery.mockResolvedValue(undefined); saveHeartbeat.mockResolvedValue(undefined); send.mockResolvedValue({ ok: true, result: { message_id: 1 } }); });

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

  it("saves signals and alerts only after a changed strong signal", async () => {
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
});
