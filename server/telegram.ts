import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import * as db from "./db";
import { fetchAndAnalyzeMarket } from "./market-data";
import type { MarketSymbol, SignalSnapshot } from "./signal-engine";

type TelegramMessage = {
  text?: unknown;
  chat?: { id?: number | string };
};

type TelegramUpdate = {
  update_id?: unknown;
  message?: TelegramMessage;
};

const COMMAND_SYMBOLS: Record<string, MarketSymbol> = {
  "/btc": "BTCUSDT",
  "/eth": "ETHUSDT",
};

export function parseTelegramCommand(value: unknown): MarketSymbol | null {
  if (typeof value !== "string") return null;
  return COMMAND_SYMBOLS[value.trim().toLowerCase()] ?? null;
}

export function isValidTelegramWebhookSecret(received: unknown, expected: string): boolean {
  if (typeof received !== "string" || !expected) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

const price = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTelegramSignal(symbol: MarketSymbol, signals: SignalSnapshot[]): string {
  const primary = signals.find(signal => signal.timeframe === "1h") ?? signals[0];
  if (!primary) return `No stored signal is available for ${symbol}.`;
  const plan = primary.plan;
  const freshness = primary.freshness.stale ? "STALE — awaiting the expected candle close" : "Fresh";
  const trendRows = signals
    .map(signal => `${signal.timeframe}: ${signal.status}`)
    .join(" · ");
  return [
    `<b>${symbol === "BTCUSDT" ? "BTC" : "ETH"}/USDT SIGNAL</b>`,
    `Price: <b>${price(primary.currentPrice)}</b>`,
    `1h direction: <b>${primary.status}</b> | Risk: <b>${primary.riskScore}</b>`,
    `Confluence: <b>${primary.confluenceScore}%</b>`,
    `Entry: <b>${price(plan.entryLow)} – ${price(plan.entryHigh)}</b>`,
    `TP: <b>${price(plan.takeProfit)}</b> | SL: <b>${price(plan.stopLoss)}</b>`,
    `Frames: ${trendRows}`,
    `Data: <b>${freshness}</b>`,
    "<i>Technical market analysis only — not financial advice.</i>",
  ].join("\n");
}

async function sendTelegramMessage(chatId: string, html: string): Promise<void> {
  if (!ENV.telegramBotToken) throw new Error("Telegram bot token is not configured");
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram sendMessage failed: ${response.status}`);
  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (!body.ok) throw new Error(body.description ?? "Telegram sendMessage returned an unsuccessful result");
}

async function signalSetForCommand(symbol: MarketSymbol): Promise<SignalSnapshot[]> {
  const stored = await db.getLatestSignalSnapshots();
  const snapshots = stored
    .filter(row => row.symbol === symbol)
    .map(row => row.snapshot as unknown as SignalSnapshot);
  if (snapshots.length === 5) return snapshots;
  return (await fetchAndAnalyzeMarket()).filter(signal => signal.symbol === symbol);
}

export function deriveWebhookUrl(req: Pick<Request, "protocol" | "headers">): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = (typeof forwardedProto === "string" ? forwardedProto.split(",")[0] : req.protocol ?? "").trim().toLowerCase();
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (typeof forwardedHost === "string" ? forwardedHost.split(",")[0] : req.headers.host ?? "").trim();
  if (protocol !== "https" || !host) {
    throw new Error("Telegram webhook activation requires a published HTTPS request domain");
  }
  const origin = new URL(`https://${host}`).origin;
  return `${origin}/api/telegram/webhook`;
}

export async function configureTelegramWebhook(req: Pick<Request, "protocol" | "headers">): Promise<{ ok: boolean; description?: string; callbackUrl: string }> {
  if (!ENV.telegramBotToken || !ENV.telegramWebhookSecret) {
    throw new Error("Telegram bot token and webhook secret must be configured before setting the webhook");
  }
  const callbackUrl = deriveWebhookUrl(req);
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: callbackUrl,
      secret_token: ENV.telegramWebhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    }),
  });
  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !body.ok) throw new Error(body.description ?? `Telegram setWebhook failed: ${response.status}`);
  return { ok: true, description: body.description, callbackUrl };
}

export async function telegramWebhookHandler(req: Request, res: Response): Promise<void> {
  if (!isValidTelegramWebhookSecret(req.headers["x-telegram-bot-api-secret-token"], ENV.telegramWebhookSecret)) {
    res.status(401).json({ error: "invalid_webhook_secret" });
    return;
  }
  const update = req.body as TelegramUpdate;
  const updateId = typeof update.update_id === "number" ? update.update_id : null;
  const chatId = update.message?.chat?.id;
  const command = update.message?.text;
  const symbol = parseTelegramCommand(command);
  if (!updateId || chatId === undefined || !symbol) {
    res.status(200).json({ ok: true, skipped: "unsupported_update" });
    return;
  }
  const commandText = typeof command === "string" ? command.trim().toLowerCase() : "";
  const isNewUpdate = await db.reserveTelegramUpdate({ updateId, chatId: String(chatId), command: commandText, symbol });
  if (!isNewUpdate) {
    res.status(200).json({ ok: true, skipped: "duplicate" });
    return;
  }
  try {
    const signals = await signalSetForCommand(symbol);
    await sendTelegramMessage(String(chatId), formatTelegramSignal(symbol, signals));
    await db.completeTelegramDelivery(updateId, { status: "sent" });
    res.status(200).json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.completeTelegramDelivery(updateId, { status: "failed", error: message });
    res.status(500).json({ error: "telegram_delivery_failed", detail: message });
  }
}
