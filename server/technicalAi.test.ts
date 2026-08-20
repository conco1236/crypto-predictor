import { describe, expect, it } from "vitest";
import { decryptTechnicalAiKey, encryptTechnicalAiKey } from "./db";
import { selectAutomaticTechnicalModel, validateManualApiBaseUrl } from "./services/technicalAi";

describe("technical AI model routing", () => {
  it("selects the preferred available workspace model for automatic mode", () => {
    expect(selectAutomaticTechnicalModel(["claude-opus-4-7", "gpt-5-mini", "gpt-5-nano"])).toBe("gpt-5-nano");
    expect(selectAutomaticTechnicalModel(["claude-opus-4-7"])).toBe("claude-opus-4-7");
  });
  it("only permits public HTTPS endpoints for manual API configuration", () => {
    expect(validateManualApiBaseUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(() => validateManualApiBaseUrl("http://api.example.com")).toThrow(/HTTPS public/);
    expect(() => validateManualApiBaseUrl("https://127.0.0.1/v1")).toThrow(/HTTPS public/);
    expect(() => validateManualApiBaseUrl("https://localhost/v1")).toThrow(/HTTPS public/);
  });
  it("encrypts a user-provided API key before persistence and only decrypts on the server", () => {
    const original = "test-api-key-not-for-production";
    const encrypted = encryptTechnicalAiKey(original);
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(original);
    expect(decryptTechnicalAiKey(encrypted)).toBe(original);
  });
});
