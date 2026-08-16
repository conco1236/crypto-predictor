import { describe, expect, it } from "vitest";
import { isValidTelegramWebhookSecret } from "./services/telegramWebhook";

describe("Telegram paper webhook secret", () => {
  it("accepts the configured secret format", () => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(isValidTelegramWebhookSecret(secret, secret)).toBe(true);
    expect(isValidTelegramWebhookSecret(secret, `${secret}-wrong`)).toBe(false);
    expect(isValidTelegramWebhookSecret(secret, secret.slice(0, Math.max(1, secret.length - 1)))).toBe(false);
  });
});
