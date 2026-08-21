import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import * as db from "./db";
import { refreshMarketSignals } from "./signal-service";

export function isAuthorizedVercelCron(header: unknown, cronSecret = ENV.cronSecret): boolean {
  if (typeof header !== "string" || !cronSecret) return false;
  const expected = `Bearer ${cronSecret}`;
  const receivedBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function vercelMarketRefreshHandler(req: Request, res: Response): Promise<void> {
  if (!isAuthorizedVercelCron(req.headers.authorization)) {
    res.status(401).json({ error: "unauthorized_cron" });
    return;
  }
  try {
    await db.markMarketRefresh({ status: "started", scheduleCronTaskUid: "vercel-cron" });
    const signals = await refreshMarketSignals();
    await db.markMarketRefresh({ status: "success", count: signals.length, scheduleCronTaskUid: "vercel-cron" });
    res.status(200).json({ ok: true, refreshedSignals: signals.length, timestamp: new Date().toISOString() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await db.markMarketRefresh({ status: "failed", error: detail, scheduleCronTaskUid: "vercel-cron" }).catch(() => undefined);
    res.status(500).json({ error: "market_refresh_failed", detail, timestamp: new Date().toISOString() });
  }
}
