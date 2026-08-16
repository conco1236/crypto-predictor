import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

const { createJob, updateJob, getSettings, saveSettings, getDeliveryHistory, getHeartbeatHistory } = vi.hoisted(() => ({
  createJob: vi.fn(), updateJob: vi.fn(), getSettings: vi.fn(), saveSettings: vi.fn(), getDeliveryHistory: vi.fn(), getHeartbeatHistory: vi.fn(),
}));

vi.mock("./_core/heartbeat", () => ({ createHeartbeatJob: createJob, updateHeartbeatJob: updateJob }));
vi.mock("./db", () => ({
  getTelegramSettings: getSettings,
  saveTelegramSettings: saveSettings,
  getTelegramDeliveryHistory: getDeliveryHistory,
  getHeartbeatHistory,
  getLastSignal: vi.fn(), getProcessedCandle: vi.fn(), getSignalHistory: vi.fn(), markProcessedCandle: vi.fn(), saveSignalSnapshot: vi.fn(),
}));

const user = { id: 1, openId: "user-1", name: "Test", email: "test@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } as any;
const ctx = { user, req: { headers: { cookie: "app_session_id=session-123" } }, res: {} } as any;

describe("telegram.save Heartbeat synchronization", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("NODE_ENV", "production"); saveSettings.mockResolvedValue({}); updateJob.mockResolvedValue({}); });

  it("updates an existing job instead of creating a duplicate", async () => {
    getSettings.mockResolvedValue({ userId: 1, botToken: "1234567890:TESTTOKEN", scheduleCronTaskUid: "task-existing" });
    const caller = appRouter.createCaller(ctx);
    await caller.telegram.save({ botToken: "1234567890:TESTTOKEN", chatId: "chat-1", alertThreshold: 60, enabled: true });
    expect(createJob).not.toHaveBeenCalled();
    expect(updateJob).toHaveBeenCalledWith("task-existing", expect.objectContaining({ cron: "0 * * * * *", path: "/api/scheduled/refresh-signals", method: "POST" }), "session-123");
    expect(saveSettings).toHaveBeenCalledWith(1, expect.objectContaining({ enabled: 1 }), "task-existing");
  });

  it("returns delivery and heartbeat history for the signed-in user", async () => {
    getDeliveryHistory.mockResolvedValue([{ id: 1, status: "failed", attempts: 2 }]);
    getHeartbeatHistory.mockResolvedValue([{ id: 2, status: "success", alertCount: 0 }]);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.telegram.deliveryHistory({ limit: 8 })).resolves.toEqual([{ id: 1, status: "failed", attempts: 2 }]);
    await expect(caller.telegram.heartbeatHistory({ limit: 5 })).resolves.toEqual([{ id: 2, status: "success", alertCount: 0 }]);
    expect(getDeliveryHistory).toHaveBeenCalledWith(1, 8);
    expect(getHeartbeatHistory).toHaveBeenCalledWith(1, 5);
  });
});
