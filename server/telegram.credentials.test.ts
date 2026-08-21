import { describe, expect, it } from "vitest";
import { isValidTelegramWebhookSecret } from "./telegram";

describe("configured Telegram credentials", () => {
  it("authenticates the configured bot token with Telegram getMe and accepts the webhook secret format", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    expect(token).toMatch(/^\d+:[A-Za-z0-9_-]+$/);
    expect(webhookSecret).toMatch(/^[A-Za-z0-9_-]{1,256}$/);
    expect(isValidTelegramWebhookSecret(webhookSecret, webhookSecret)).toBe(true);

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const body = (await response.json()) as { ok?: boolean; result?: { is_bot?: boolean; username?: string } };
    expect(response.ok).toBe(true);
    expect(body.ok).toBe(true);
    expect(body.result?.is_bot).toBe(true);
    expect(body.result?.username).toBeTruthy();
  }, 15_000);
});
