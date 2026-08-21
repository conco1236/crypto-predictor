import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { configureTelegramWebhook } from "./telegram";

export function isAuthorizedVercelSetup(header: unknown, setupToken = ENV.adminSetupToken): boolean {
  if (typeof header !== "string" || !setupToken) return false;
  const expected = `Bearer ${setupToken}`;
  const receivedBuffer = Buffer.from(header);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function registerVercelTelegramWebhook(req: Request, res: Response): Promise<void> {
  if (!isAuthorizedVercelSetup(req.headers.authorization)) {
    res.status(401).json({ error: "unauthorized_setup" });
    return;
  }
  try {
    const result = await configureTelegramWebhook(req);
    res.status(200).json({ ok: true, callbackUrl: result.callbackUrl });
  } catch (error) {
    res.status(500).json({ error: "telegram_webhook_registration_failed", detail: error instanceof Error ? error.message : String(error) });
  }
}
