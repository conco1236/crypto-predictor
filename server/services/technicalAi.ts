import { getTechnicalAiSecret, getTechnicalAiSettings, type TechnicalAiMode } from "../db";
import { invokeLLM, listLLMModels, type InvokeParams, type InvokeResult } from "../_core/llm";

const AUTO_PREFERENCES = ["gpt-5-nano", "gpt-5-mini", "claude-haiku-4-5", "gemini-3-flash-preview"];
const MODEL_ID = /^[a-zA-Z0-9._:-]{1,160}$/;
const CACHE_MS = 5 * 60_000;
const MANUAL_CONNECTION_TIMEOUT_MS = 8_000;
let modelCache: { expiresAt: number; ids: string[] } | undefined;

export type AvailableTechnicalModel = { id: string; source: "workspace"; autoEligible: boolean };

export async function getAvailableTechnicalModels() {
  if (modelCache && modelCache.expiresAt > Date.now()) return modelCache.ids.map(id => ({ id, source: "workspace" as const, autoEligible: AUTO_PREFERENCES.includes(id) }));
  const response = await listLLMModels();
  const ids = response.data.map(model => model.id).filter(id => MODEL_ID.test(id)).sort();
  modelCache = { ids, expiresAt: Date.now() + CACHE_MS };
  return ids.map(id => ({ id, source: "workspace" as const, autoEligible: AUTO_PREFERENCES.includes(id) }));
}

export function selectAutomaticTechnicalModel(ids: string[]) {
  return AUTO_PREFERENCES.find(id => ids.includes(id)) ?? ids[0] ?? null;
}

export function validateManualApiBaseUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const privateIpv4 = /^(127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
  if (url.protocol !== "https:" || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || privateIpv4) throw new Error("API endpoint phải là HTTPS public; không dùng localhost hoặc địa chỉ private");
  return url.toString().replace(/\/$/, "");
}

function manualCompletionUrl(baseUrl: string) {
  const url = validateManualApiBaseUrl(baseUrl);
  return /\/chat\/completions$/.test(url) ? url : `${url.replace(/\/$/, "")}/v1/chat/completions`;
}

export function createManualConnectionPayload(model: string) {
  if (!MODEL_ID.test(model)) throw new Error("Model Manual API không hợp lệ");
  return { model, messages: [{ role: "system", content: "Connection health check. Reply with OK only." }, { role: "user", content: "OK" }], max_tokens: 8 };
}

export type ManualApiQuota = { status: "quota" | "rate_limit" | "unavailable"; remaining?: number; limit?: number; unit?: string; reset?: string; source?: string };

function numericHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const raw = headers.get(name);
    if (raw == null) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) return value;
  }
  return undefined;
}

function textHeader(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }
  return undefined;
}

export function readManualApiQuotaHeaders(headers: Headers): ManualApiQuota {
  const quotaRemaining = numericHeader(headers, ["x-quota-remaining", "x-credits-remaining", "x-usage-remaining"]);
  if (quotaRemaining != null) return { status: "quota", remaining: quotaRemaining, limit: numericHeader(headers, ["x-quota-limit", "x-credits-limit", "x-usage-limit"]), unit: textHeader(headers, ["x-quota-unit", "x-credits-unit", "x-usage-unit"]), source: "provider quota header" };
  const requestRemaining = numericHeader(headers, ["x-ratelimit-remaining-requests", "ratelimit-remaining"]);
  if (requestRemaining != null) return { status: "rate_limit", remaining: requestRemaining, limit: numericHeader(headers, ["x-ratelimit-limit-requests", "ratelimit-limit"]), unit: "requests", reset: textHeader(headers, ["x-ratelimit-reset-requests", "ratelimit-reset"]), source: "provider rate-limit header" };
  return { status: "unavailable" };
}

export async function probeManualOpenAiCompatible(baseUrl: string, apiKey: string, model: string, fetchImpl: typeof fetch = fetch) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(manualCompletionUrl(baseUrl), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(createManualConnectionPayload(model)), signal: AbortSignal.timeout(MANUAL_CONNECTION_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json().catch(() => null) as { model?: unknown; choices?: unknown } | null;
    if (!payload || !Array.isArray(payload.choices)) throw new Error("INVALID_RESPONSE");
    return { ok: true as const, model: typeof payload.model === "string" ? payload.model : model, latencyMs: Date.now() - startedAt, quota: readManualApiQuotaHeaders(response.headers) };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw new Error("Manual AI API không phản hồi trong 8 giây");
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (/^HTTP \d{3}$/.test(message)) throw new Error(`Manual AI API ${message}`);
    if (message === "INVALID_RESPONSE") throw new Error("Manual AI API trả về phản hồi không tương thích");
    throw new Error("Không thể kết nối Manual AI API");
  }
}

async function invokeManualOpenAiCompatible(baseUrl: string, apiKey: string, params: InvokeParams, model: string): Promise<InvokeResult> {
  const response = await fetch(manualCompletionUrl(baseUrl), { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, messages: params.messages, max_tokens: params.maxTokens ?? params.max_tokens ?? 700 }) });
  if (!response.ok) throw new Error(`Manual AI API trả về HTTP ${response.status}`);
  return await response.json() as InvokeResult;
}

export async function invokeTechnicalAi(userId: number, params: InvokeParams) {
  const settings = await getTechnicalAiSettings(userId);
  const mode = settings.mode as TechnicalAiMode;
  if (mode === "manual_api") {
    if (!settings.apiBaseUrl) throw new Error("Cần nhập API endpoint cho Manual API");
    const apiKey = await getTechnicalAiSecret(userId);
    if (!apiKey) throw new Error("Cần nhập API key cho Manual API");
    if (!MODEL_ID.test(settings.model)) throw new Error("Model Manual API không hợp lệ");
    return invokeManualOpenAiCompatible(settings.apiBaseUrl, apiKey, params, settings.model);
  }
  const models = await getAvailableTechnicalModels();
  const ids = models.map(model => model.id);
  const model = mode === "workspace_model" && ids.includes(settings.model) ? settings.model : selectAutomaticTechnicalModel(ids);
  if (!model) throw new Error("Không có model AI workspace khả dụng");
  return invokeLLM({ ...params, model });
}

export async function testManualTechnicalAiConnection(userId: number) {
  const settings = await getTechnicalAiSettings(userId);
  if (settings.mode !== "manual_api" || !settings.apiBaseUrl) throw new Error("Chỉ kiểm tra được khi Manual API đã được lưu và bật");
  const apiKey = await getTechnicalAiSecret(userId);
  if (!apiKey) throw new Error("Cần lưu API key trước khi kiểm tra kết nối");
  return probeManualOpenAiCompatible(settings.apiBaseUrl, apiKey, settings.model);
}
