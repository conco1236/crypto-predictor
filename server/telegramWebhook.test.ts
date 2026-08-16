import { describe, expect, it } from "vitest";
import { isValidTelegramWebhookSecret } from "./services/telegramWebhook";
import { buildPaperTradeInlineKeyboard, buildSandboxConfirmationKeyboard } from "./services/telegram";

describe("Telegram paper webhook secret", () => {
  it("accepts the configured secret format", () => {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(isValidTelegramWebhookSecret(secret, secret)).toBe(true);
    expect(isValidTelegramWebhookSecret(secret, `${secret}-wrong`)).toBe(false);
    expect(isValidTelegramWebhookSecret(secret, secret.slice(0, Math.max(1, secret.length - 1)))).toBe(false);
  });

  it("builds paper-only callback controls without live order actions", () => {
    const keyboard = buildPaperTradeInlineKeyboard(42, false);
    const callbacks = keyboard.inline_keyboard.flat().map(button => button.callback_data).filter(Boolean);
    expect(callbacks).toContain("paper:close:42");
    expect(callbacks).toContain("paper:pause");
    expect(callbacks).toContain("live:blocked");
    expect(callbacks.filter(value => value?.startsWith("paper:")).length).toBe(2);
    expect(callbacks).toContain("live:blocked");
    expect(callbacks).not.toContain("live:execute");
    const confirmation = buildSandboxConfirmationKeyboard("abc123");
    const confirmationCallbacks = confirmation.inline_keyboard.flat().map(button => button.callback_data);
    expect(confirmationCallbacks).toEqual(["sandbox:confirm:abc123", "sandbox:cancel:abc123"]);
  });
});
