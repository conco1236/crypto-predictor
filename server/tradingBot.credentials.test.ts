import { describe, expect, it } from "vitest";

type CredentialInput = { apiKey?: string; apiSecret?: string; passphrase?: string; allowWithdraw?: boolean };

function validateCredentialInput(input: CredentialInput) {
  if (!input.apiKey?.trim() || !input.apiSecret?.trim()) return { ok: false, reason: "missing_credentials" };
  if (input.allowWithdraw) return { ok: false, reason: "withdrawal_permission_forbidden" };
  return { ok: true, reason: "ready_for_server_side_storage" };
}

describe("Trading Bot credential safety", () => {
  it("rejects empty credentials without making an external request", () => {
    expect(validateCredentialInput({})).toEqual({ ok: false, reason: "missing_credentials" });
  });

  it("rejects withdrawal permission", () => {
    expect(validateCredentialInput({ apiKey: "key", apiSecret: "secret", allowWithdraw: true })).toEqual({ ok: false, reason: "withdrawal_permission_forbidden" });
  });

  it("accepts non-withdrawal credentials for server-side storage", () => {
    expect(validateCredentialInput({ apiKey: "key", apiSecret: "secret", passphrase: "pass", allowWithdraw: false })).toEqual({ ok: true, reason: "ready_for_server_side_storage" });
  });
});
