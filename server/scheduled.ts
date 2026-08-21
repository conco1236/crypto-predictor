import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { refreshMarketSignals } from "./signal-service";

export function isAuthorizedMarketRefreshCron(
  user: { isCron?: boolean; taskUid?: string },
  setting: { scheduleCronTaskUid?: string | null; enabled: boolean } | undefined
): boolean {
  return Boolean(user.isCron && user.taskUid && setting?.enabled && setting.scheduleCronTaskUid === user.taskUid);
}

export async function marketRefreshScheduledHandler(req: Request, res: Response): Promise<void> {
  let taskUid: string | undefined;
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      res.status(403).json({ error: "cron_only" });
      return;
    }
    taskUid = user.taskUid;
    const setting = await db.getMarketRefreshSetting();
    if (!isAuthorizedMarketRefreshCron(user, setting)) {
      res.status(200).json({ ok: true, skipped: "orphan_or_disabled" });
      return;
    }
    const signals = await refreshMarketSignals();
    res.status(200).json({ ok: true, taskUid, refreshedSignals: signals.length, timestamp: new Date().toISOString() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: "market_refresh_failed",
      detail,
      context: { taskUid, path: req.path },
      timestamp: new Date().toISOString(),
    });
  }
}
