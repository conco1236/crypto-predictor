import { getTechnicalAiSettings, getTelegramSettings, updateTechnicalAiQuotaAlertState } from "../db";
import { type ManualApiQuota } from "./technicalAi";
import { sendTelegramMessage } from "./telegram";

export function evaluateLowQuota(quota: ManualApiQuota, thresholdPercent: number) {
  if (quota.status === "unavailable" || quota.remaining == null || quota.limit == null || quota.limit <= 0) return { state: "unavailable" as const, percent: null, kind: null };
  const percent = Math.max(0, (quota.remaining / quota.limit) * 100);
  return { state: percent <= thresholdPercent ? "low" as const : "normal" as const, percent, kind: quota.status };
}

export function formatTechnicalAiQuotaAlert(input: { kind: "quota" | "rate_limit"; remaining: number; limit: number; percent: number; unit?: string; reset?: string }) {
  const label = input.kind === "quota" ? "AI API quota thấp" : "AI API rate limit thấp";
  return [`<b>⚠️ ${label}</b>`, `Còn lại: <b>${input.remaining.toFixed(2)} / ${input.limit.toFixed(2)}</b> ${input.unit ?? ""} (${input.percent.toFixed(1)}%)`, ...(input.reset ? [`Reset: ${input.reset}`] : []), "<i>Cảnh báo quan sát. Không thay đổi tín hiệu, Trade/No Trade hoặc giao dịch.</i>"].join("\n");
}

export async function processTechnicalAiQuotaAlert(userId: number, quota: ManualApiQuota) {
  const ai = await getTechnicalAiSettings(userId);
  const evaluation = evaluateLowQuota(quota, ai.quotaAlertThresholdPercent ?? 10);
  if (evaluation.state !== "low" || !evaluation.kind || quota.remaining == null || quota.limit == null) {
    await updateTechnicalAiQuotaAlertState(userId, { state: evaluation.state, kind: evaluation.kind, percent: evaluation.percent, deliveryStatus: "pending" });
    return { sent: false, state: evaluation.state, percent: evaluation.percent };
  }
  const alreadyDelivered = ai.quotaAlertState === "low" && ai.quotaAlertKind === evaluation.kind && ai.quotaAlertDeliveryStatus === "sent";
  if (alreadyDelivered || ai.quotaAlertEnabled !== 1) {
    await updateTechnicalAiQuotaAlertState(userId, { state: "low", kind: evaluation.kind, percent: evaluation.percent, deliveryStatus: ai.quotaAlertDeliveryStatus as "pending" | "sent" | "failed" });
    return { sent: false, state: "low" as const, percent: evaluation.percent };
  }
  const telegram = await getTelegramSettings(userId);
  if (!telegram?.enabled || !telegram.botToken || !telegram.chatId) {
    await updateTechnicalAiQuotaAlertState(userId, { state: "low", kind: evaluation.kind, percent: evaluation.percent, deliveryStatus: "pending" });
    return { sent: false, state: "low" as const, percent: evaluation.percent, skipped: "telegram-disabled" };
  }
  await updateTechnicalAiQuotaAlertState(userId, { state: "low", kind: evaluation.kind, percent: evaluation.percent, deliveryStatus: "pending" });
  try {
    await sendTelegramMessage(telegram.botToken, telegram.chatId, formatTechnicalAiQuotaAlert({ kind: evaluation.kind, remaining: quota.remaining, limit: quota.limit, percent: evaluation.percent, unit: quota.unit, reset: quota.reset }));
    await updateTechnicalAiQuotaAlertState(userId, { state: "low", kind: evaluation.kind, percent: evaluation.percent, deliveryStatus: "sent", alertedAt: new Date() });
    return { sent: true, state: "low" as const, percent: evaluation.percent };
  } catch {
    await updateTechnicalAiQuotaAlertState(userId, { state: "low", kind: evaluation.kind, percent: evaluation.percent, deliveryStatus: "failed" });
    return { sent: false, state: "low" as const, percent: evaluation.percent, skipped: "delivery-failed" };
  }
}
