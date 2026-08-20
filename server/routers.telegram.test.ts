import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const { createJob, updateJob, getSettings, saveSettings, getDeliveryHistory, getHeartbeatHistory, getDeliveryById, updateDelivery, createDelivery, sendMessage, getRules, upsertRule, deleteRule } = vi.hoisted(() => ({
  createJob: vi.fn(), updateJob: vi.fn(), getSettings: vi.fn(), saveSettings: vi.fn(), getDeliveryHistory: vi.fn(), getHeartbeatHistory: vi.fn(), getDeliveryById: vi.fn(), updateDelivery: vi.fn(), createDelivery: vi.fn(), sendMessage: vi.fn(), getRules: vi.fn(), upsertRule: vi.fn(), deleteRule: vi.fn(),
}));

vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: createJob, updateHeartbeatJob: updateJob }));
vi.mock("./services/telegram", () => ({ sendTelegramMessage: sendMessage, formatSignalAlert: vi.fn(() => "alert") }));
vi.mock("./db", () => ({
  getTelegramSettings: getSettings,
  saveTelegramSettings: saveSettings,
  getTelegramDeliveryHistory: getDeliveryHistory,
  getHeartbeatHistory,
  getTelegramDeliveryLogById: getDeliveryById,
  updateTelegramDeliveryLog: updateDelivery,
  createTelegramDeliveryLog: createDelivery,
  getTelegramAlertRules: getRules,
  upsertTelegramAlertRule: upsertRule,
  deleteTelegramAlertRule: deleteRule,
  getLastSignal: vi.fn(), getProcessedCandle: vi.fn(), getSignalHistory: vi.fn(), markProcessedCandle: vi.fn(), saveSignalSnapshot: vi.fn(),
}));

const user = { id: 1, openId: "user-1", name: "Test", email: "test@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as any;
const ctx = { user, req: { headers: { cookie: "app_session_id=session-123" } }, res: {} } as any;

describe("telegram.save Heartbeat synchronization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); saveSettings.mockResolvedValue({}); updateJob.mockResolvedValue({}); updateDelivery.mockResolvedValue(undefined); sendMessage.mockResolvedValue({ result: { message_id: 99 } }); getRules.mockResolvedValue([]); upsertRule.mockResolvedValue({ id: 11 }); deleteRule.mockResolvedValue(undefined); });

  it("updates an existing job instead of creating a duplicate", async () => {
    getSettings.mockResolvedValue({ userId: 1, botToken: "1234567890:TESTTOKEN", scheduleCronTaskUid: "task-existing" });
    const caller = appRouter.createCaller(ctx);
    await caller.telegram.save({ botToken: "1234567890:TESTTOKEN", chatId: "chat-1", alertThreshold: 60, enabled: true });
    expect(createJob).not.toHaveBeenCalled();
    expect(updateJob).toHaveBeenCalledWith("task-existing", expect.objectContaining({ cron: "0 * * * * *", path: "/api/scheduled/refresh-signals", method: "POST" }), "session-123");
    expect(saveSettings).toHaveBeenCalledWith(1, expect.objectContaining({ enabled: 1 }), "task-existing");
  });

  it("persists a user-selected quality penalty threshold with the authenticated user's settings", async () => {
    getSettings.mockResolvedValue({ userId: 1, botToken: "1234567890:TESTTOKEN", scheduleCronTaskUid: "task-existing" });
    const caller = appRouter.createCaller(ctx);
    await caller.telegram.save({ botToken: "1234567890:TESTTOKEN", chatId: "chat-1", alertThreshold: 60, qualityAlertThreshold: 31, enabled: true });
    expect(saveSettings).toHaveBeenCalledWith(1, expect.objectContaining({ qualityAlertThreshold: 31 }), "task-existing");
  });

  it("returns delivery and heartbeat history for the signed-in user", async () => {
    getDeliveryHistory.mockResolvedValue([{ id: 1, status: "failed", attempts: 2 }]);
    getHeartbeatHistory.mockResolvedValue([{ id: 2, status: "success", alertCount: 0 }]);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.deliveryHistory({ limit: 8 })).resolves.toEqual([{ id: 1, status: "failed", attempts: 2 }]);
    await expect(caller.telegram.heartbeatHistory({ limit: 5 })).resolves.toEqual([{ id: 2, status: "success", alertCount: 0 }]);
    expect(getDeliveryHistory).toHaveBeenCalledWith(1, 8, { limit: 8 });
    expect(getHeartbeatHistory).toHaveBeenCalledWith(1, 5, undefined);
  });

  it("reads, saves and updates a scoped alert rule for the authenticated user", async () => {
    getRules.mockResolvedValue([{ id: 11, userId: 1, symbol: "BTCUSDT", exchange: "Binance", interval: "1h", alertThreshold: 70, enabled: 1 }]);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.rules()).resolves.toHaveLength(1);
    await caller.telegram.saveRule({ symbol: "BTCUSDT", exchange: "Binance", interval: "1h", alertThreshold: 70, enabled: true });
    await caller.telegram.saveRule({ symbol: "BTCUSDT", exchange: "Binance", interval: "1h", alertThreshold: 80, enabled: false });
    expect(getRules).toHaveBeenCalledWith(1);
    expect(upsertRule).toHaveBeenNthCalledWith(2, 1, { symbol: "BTCUSDT", exchange: "Binance", interval: "1h", alertThreshold: 80, enabled: 0 });
  });

  it("scopes rule deletion to the authenticated user", async () => {
    const caller = appRouter.createCaller(ctx);
    await caller.telegram.deleteRule({ id: 11 });
    expect(deleteRule).toHaveBeenCalledWith(1, 11);
  });

  it("rejects retry when the delivery is not owned by the authenticated user", async () => {
    getDeliveryById.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.retryDelivery({ id: 999 })).rejects.toThrow("Không tìm thấy bản ghi delivery");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not create a new delivery or send again across repeated retry calls", async () => {
    getDeliveryById.mockResolvedValue({ id: 7, userId: 1, status: "sent", attempts: 1, message: "alert body" });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.retryDelivery({ id: 7 })).resolves.toMatchObject({ status: "sent" });
    expect(sendMessage).not.toHaveBeenCalled();
    expect(updateDelivery).not.toHaveBeenCalled();
    expect(createDelivery).not.toHaveBeenCalled();
  });

  it("retries the same failed delivery repeatedly without creating another record", async () => {
    const failed1 = { id: 8, userId: 1, status: "failed", attempts: 1, message: "alert body" };
    const failed2 = { ...failed1, attempts: 2 };
    const sent = { ...failed1, status: "sent", attempts: 3, telegramMessageId: "99" };
    getDeliveryById.mockResolvedValueOnce(failed1).mockResolvedValueOnce(failed2).mockResolvedValueOnce(sent);
    getSettings.mockResolvedValue({ botToken: "1234567890:TESTTOKEN", chatId: "chat-1", enabled: 1 });
    sendMessage.mockRejectedValueOnce(new Error("temporary Telegram error")).mockResolvedValueOnce({ result: { message_id: 99 } });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.retryDelivery({ id: 8 })).rejects.toThrow("temporary Telegram error");
    await caller.telegram.retryDelivery({ id: 8 });
    expect(createDelivery).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(updateDelivery).toHaveBeenNthCalledWith(1, 8, expect.objectContaining({ status: "pending", attempts: 2 }));
    expect(updateDelivery).toHaveBeenNthCalledWith(2, 8, expect.objectContaining({ status: "failed" }));
    expect(updateDelivery).toHaveBeenNthCalledWith(3, 8, expect.objectContaining({ status: "pending", attempts: 3 }));
    expect(updateDelivery).toHaveBeenNthCalledWith(4, 8, expect.objectContaining({ status: "sent", telegramMessageId: "99" }));
  });

  it("retries a failed delivery through the authenticated user's record", async () => {
    const failed = { id: 7, userId: 1, status: "failed", attempts: 1, message: "alert body", botToken: undefined };
    getDeliveryById.mockResolvedValueOnce(failed).mockResolvedValueOnce({ ...failed, status: "sent", attempts: 2, telegramMessageId: "99" });
    getSettings.mockResolvedValue({ botToken: "1234567890:TESTTOKEN", chatId: "chat-1", enabled: 1 });
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.retryDelivery({ id: 7 })).resolves.toMatchObject({ status: "sent" });
    expect(sendMessage).toHaveBeenCalledWith("1234567890:TESTTOKEN", "chat-1", "alert body");
    expect(updateDelivery).toHaveBeenCalledWith(7, expect.objectContaining({ status: "sent", telegramMessageId: "99" }));
  });
});
