import { describe, expect, it } from "vitest";
import { decryptTechnicalAiKey, encryptTechnicalAiKey } from "./db";
import { createManualConnectionPayload, probeManualOpenAiCompatible, selectAutomaticTechnicalModel, validateManualApiBaseUrl } from "./services/technicalAi";

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
  it("probes a compatible endpoint with a minimal request and does not surface secret values", async () => {
    const response = await probeManualOpenAiCompatible("https://api.example.com", "super-secret-token", "example-model", async (url, init) => {
      expect(String(url)).toBe("https://api.example.com/v1/chat/completions");
      expect(init?.headers).toMatchObject({ authorization: "Bearer super-secret-token" });
      expect(JSON.parse(String(init?.body))).toEqual(createManualConnectionPayload("example-model"));
      return new Response(JSON.stringify({ model: "example-model", choices: [{ message: { content: "OK" } }] }), { status: 200 });
    });
    expect(response).toMatchObject({ ok: true, model: "example-model" });
  });
  it("returns a sanitized connection error instead of an upstream response body", async () => {
    await expect(probeManualOpenAiCompatible("https://api.example.com", "secret", "example-model", async () => new Response("secret leaked upstream", { status: 401 }))).rejects.toThrow("Manual AI API HTTP 401");
  });
});
