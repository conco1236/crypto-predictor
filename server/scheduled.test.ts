import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getMarketRefreshSetting: vi.fn(),
  refreshMarketSignals: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getMarketRefreshSetting: mocks.getMarketRefreshSetting }));
vi.mock("./signal-service", () => ({ refreshMarketSignals: mocks.refreshMarketSignals }));

import { marketRefreshScheduledHandler } from "./scheduled";

function responseRecorder() {
  const result: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) { result.status = code; return this; },
    json(body: unknown) { result.body = body; return this; },
  } as unknown as Response;
  return { res, result };
}

describe("marketRefreshScheduledHandler", () => {
  it("rejects a request that is not authenticated as a cron invocation", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: false });
    const { res, result } = responseRecorder();
    await marketRefreshScheduledHandler({ path: "/api/scheduled/market-refresh" } as Request, res);
    expect(result).toMatchObject({ status: 403, body: { error: "cron_only" } });
    expect(mocks.getMarketRefreshSetting).not.toHaveBeenCalled();
  });

  it("acknowledges an orphan or disabled cron without running a refresh", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-a" });
    mocks.getMarketRefreshSetting.mockResolvedValue({ enabled: false, scheduleCronTaskUid: "task-a" });
    const { res, result } = responseRecorder();
    await marketRefreshScheduledHandler({ path: "/api/scheduled/market-refresh" } as Request, res);
    expect(result).toMatchObject({ status: 200, body: { ok: true, skipped: "orphan_or_disabled" } });
    expect(mocks.refreshMarketSignals).not.toHaveBeenCalled();
  });

  it("runs a valid matching cron and returns the bounded refresh count", async () => {
    mocks.authenticateRequest.mockResolvedValue({ isCron: true, taskUid: "task-a" });
    mocks.getMarketRefreshSetting.mockResolvedValue({ enabled: true, scheduleCronTaskUid: "task-a" });
    mocks.refreshMarketSignals.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const { res, result } = responseRecorder();
    await marketRefreshScheduledHandler({ path: "/api/scheduled/market-refresh" } as Request, res);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, taskUid: "task-a", refreshedSignals: 2 });
  });
});
