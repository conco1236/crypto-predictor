import { drizzle } from "drizzle-orm/mysql2";
import { and, desc, eq, gt, like } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { aiAnalyses, aiReanalysisRequests, heartbeatRuns, InsertUser, momentumCriticalAlerts, momentumSettings, newsAiSettings, newsItems, paperBotAuditLogs, paperTrades, signalOutcomes, signalProcessingState, signalSnapshots, technicalAiSettings, telegramAlertRules, telegramDeliveryLogs, telegramQualityThresholdHistory, telegramQualityThresholdOverrides, telegramSettings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { classifyConfidenceMomentum, DEFAULT_MOMENTUM_THRESHOLDS, normalizeMomentumThresholds } from "../shared/confidenceMomentum";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) { values.role = user.role ?? "admin"; updateSet.role = values.role; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getTelegramSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramSettings).where(eq(telegramSettings.userId, userId)).limit(1);
  return result[0];
}

export async function getMomentumSettings(userId: number) {
  const db = await getDb();
  if (!db) return { userId, ...DEFAULT_MOMENTUM_THRESHOLDS };
  const result = await db.select().from(momentumSettings).where(eq(momentumSettings.userId, userId)).limit(1);
  return result[0] ?? { userId, ...DEFAULT_MOMENTUM_THRESHOLDS };
}

export async function saveMomentumSettings(userId: number, data: { criticalDropThreshold: number; deterioratingDropThreshold: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const values = normalizeMomentumThresholds(data);
  await db.insert(momentumSettings).values({ userId, ...values }).onDuplicateKeyUpdate({ set: { ...values, updatedAt: new Date() } });
  return getMomentumSettings(userId);
}

export async function getTelegramSettingsByChatId(chatId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramSettings).where(eq(telegramSettings.chatId, chatId)).limit(1);
  return result[0];
}

export async function getTelegramSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramSettings).where(eq(telegramSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function getTelegramSettingsByPaperReportTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramSettings).where(eq(telegramSettings.paperReportCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function updatePaperReportSettings(userId: number, data: { enabled?: number; cronTaskUid?: string | null; lastDate?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (data.enabled !== undefined) set.paperReportEnabled = data.enabled;
  if (data.cronTaskUid !== undefined) set.paperReportCronTaskUid = data.cronTaskUid;
  if (data.lastDate !== undefined) set.paperReportLastDate = data.lastDate;
  await db.update(telegramSettings).set(set).where(eq(telegramSettings.userId, userId));
  return getTelegramSettings(userId);
}

export async function saveTelegramSettings(userId: number, data: { botToken: string; chatId: string; alertThreshold: number; qualityAlertThreshold?: number; sendMode?: "all_candles" | "strong_only"; enabled: number }, scheduleCronTaskUid?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const sendMode = data.sendMode ?? "all_candles";
  const qualityAlertThreshold = data.qualityAlertThreshold ?? 20;
  const previous = await getTelegramSettings(userId);
  await db.insert(telegramSettings).values({ userId, ...data, qualityAlertThreshold, sendMode, scheduleCronTaskUid }).onDuplicateKeyUpdate({ set: { ...data, qualityAlertThreshold, sendMode, ...(scheduleCronTaskUid ? { scheduleCronTaskUid } : {}), updatedAt: new Date() } });
  if (previous && previous.qualityAlertThreshold !== qualityAlertThreshold) await db.insert(telegramQualityThresholdHistory).values({ userId, exchange: null, previousThreshold: previous.qualityAlertThreshold, nextThreshold: qualityAlertThreshold, source: "global" });
  return getTelegramSettings(userId);
}

export async function getQualityThresholdOverrides(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramQualityThresholdOverrides).where(eq(telegramQualityThresholdOverrides.userId, userId)).orderBy(telegramQualityThresholdOverrides.exchange);
}

export async function saveQualityThresholdOverride(userId: number, exchange: string, threshold: number) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const existing = await db.select().from(telegramQualityThresholdOverrides).where(and(eq(telegramQualityThresholdOverrides.userId, userId), eq(telegramQualityThresholdOverrides.exchange, exchange))).limit(1);
  await db.insert(telegramQualityThresholdOverrides).values({ userId, exchange, threshold }).onDuplicateKeyUpdate({ set: { threshold, updatedAt: new Date() } });
  if (!existing[0] || existing[0].threshold !== threshold) await db.insert(telegramQualityThresholdHistory).values({ userId, exchange, previousThreshold: existing[0]?.threshold ?? null, nextThreshold: threshold, source: "exchange" });
  return getQualityThresholdOverrides(userId);
}

export async function deleteQualityThresholdOverride(userId: number, exchange: string, fallbackThreshold: number) {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(telegramQualityThresholdOverrides).where(and(eq(telegramQualityThresholdOverrides.userId, userId), eq(telegramQualityThresholdOverrides.exchange, exchange))).limit(1);
  await db.delete(telegramQualityThresholdOverrides).where(and(eq(telegramQualityThresholdOverrides.userId, userId), eq(telegramQualityThresholdOverrides.exchange, exchange)));
  if (existing[0]) await db.insert(telegramQualityThresholdHistory).values({ userId, exchange, previousThreshold: existing[0].threshold, nextThreshold: fallbackThreshold, source: "exchange_reset" });
  return getQualityThresholdOverrides(userId);
}

export async function getQualityThresholdHistory(userId: number, limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramQualityThresholdHistory).where(eq(telegramQualityThresholdHistory.userId, userId)).orderBy(desc(telegramQualityThresholdHistory.createdAt)).limit(clampHistoryLimit(limit, 30, 100));
}

export async function getTelegramAlertRules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(telegramAlertRules).where(eq(telegramAlertRules.userId, userId)).orderBy(desc(telegramAlertRules.updatedAt));
}

export async function getTelegramAlertRule(userId: number, scope: { symbol: string; exchange: string; interval: string }) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramAlertRules).where(and(eq(telegramAlertRules.userId, userId), eq(telegramAlertRules.symbol, scope.symbol), eq(telegramAlertRules.exchange, scope.exchange), eq(telegramAlertRules.interval, scope.interval))).limit(1);
  return result[0];
}

export async function upsertTelegramAlertRule(userId: number, input: { symbol: string; exchange: string; interval: string; alertThreshold: number; enabled: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  await db.insert(telegramAlertRules).values({ userId, ...input }).onDuplicateKeyUpdate({ set: { alertThreshold: input.alertThreshold, enabled: input.enabled, updatedAt: new Date() } });
  return getTelegramAlertRule(userId, input);
}

export async function deleteTelegramAlertRule(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(telegramAlertRules).where(and(eq(telegramAlertRules.userId, userId), eq(telegramAlertRules.id, id)));
}

export async function getTelegramDeliveryLog(userId: number, input: { exchange: string; symbol: string; interval: string; candleOpenTime: number }) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramDeliveryLogs).where(and(eq(telegramDeliveryLogs.userId, userId), eq(telegramDeliveryLogs.exchange, input.exchange), eq(telegramDeliveryLogs.symbol, input.symbol), eq(telegramDeliveryLogs.interval, input.interval), eq(telegramDeliveryLogs.candleOpenTime, input.candleOpenTime))).limit(1);
  return result[0];
}

export function clampHistoryLimit(value: number | undefined, fallback: number, maximum = 100) {
  return Math.min(Math.max(value ?? fallback, 1), maximum);
}

export function buildTelegramDeliveryRecord(input: { userId: number; taskUid?: string; exchange: string; symbol: string; interval: string; candleOpenTime: number; candleClosedAt: number; label: "Bullish" | "Bearish" | "Neutral"; score: number; message?: string }) {
  return { ...input, taskUid: input.taskUid ?? null, message: input.message ?? null, status: "pending" as const, attempts: 0 };
}

export async function createTelegramDeliveryLog(input: { userId: number; taskUid?: string; exchange: string; symbol: string; interval: string; candleOpenTime: number; candleClosedAt: number; label: "Bullish" | "Bearish" | "Neutral"; score: number; message?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const existing = await getTelegramDeliveryLog(input.userId, input);
  if (existing) return existing;
  await db.insert(telegramDeliveryLogs).values(buildTelegramDeliveryRecord(input));
  return getTelegramDeliveryLog(input.userId, input);
}

export async function getTelegramDeliveryLogById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramDeliveryLogs).where(and(eq(telegramDeliveryLogs.userId, userId), eq(telegramDeliveryLogs.id, id))).limit(1);
  return result[0];
}

export async function updateTelegramDeliveryLog(id: number, data: { status: "pending" | "sent" | "failed"; attempts?: number; telegramMessageId?: string | null; lastError?: string | null; sentAt?: Date | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(telegramDeliveryLogs).set(data).where(eq(telegramDeliveryLogs.id, id));
}

export async function getMomentumCriticalAlert(userId: number, input: { exchange: string; symbol: string; interval: string; candleOpenTime: number }) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(momentumCriticalAlerts).where(and(eq(momentumCriticalAlerts.userId, userId), eq(momentumCriticalAlerts.exchange, input.exchange), eq(momentumCriticalAlerts.symbol, input.symbol), eq(momentumCriticalAlerts.interval, input.interval), eq(momentumCriticalAlerts.candleOpenTime, input.candleOpenTime))).limit(1);
  return result[0];
}

export async function createMomentumCriticalAlert(input: { userId: number; taskUid?: string; exchange: string; symbol: string; interval: string; candleOpenTime: number; candleClosedAt: number; previousConfidence?: number | null; confidence: number; delta?: number | null; reason: string; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const existing = await getMomentumCriticalAlert(input.userId, input);
  if (existing) return existing;
  await db.insert(momentumCriticalAlerts).values({ ...input, taskUid: input.taskUid ?? null, previousConfidence: input.previousConfidence ?? null, delta: input.delta ?? null, status: "pending", attempts: 0 });
  return getMomentumCriticalAlert(input.userId, input);
}

export async function updateMomentumCriticalAlert(id: number, data: { status: "pending" | "sent" | "failed"; attempts?: number; telegramMessageId?: string | null; lastError?: string | null; sentAt?: Date | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(momentumCriticalAlerts).set(data).where(eq(momentumCriticalAlerts.id, id));
}

export async function getMomentumCriticalAlertHistory(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(momentumCriticalAlerts).where(eq(momentumCriticalAlerts.userId, userId)).orderBy(desc(momentumCriticalAlerts.createdAt)).limit(clampHistoryLimit(limit, 20, 100));
}

export async function getTelegramDeliveryHistory(userId: number, limit = 30, filters?: { status?: "pending" | "sent" | "failed"; symbol?: string; exchange?: string; interval?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(telegramDeliveryLogs.userId, userId)];
  if (filters?.status) conditions.push(eq(telegramDeliveryLogs.status, filters.status));
  if (filters?.symbol) conditions.push(eq(telegramDeliveryLogs.symbol, filters.symbol));
  if (filters?.exchange) conditions.push(eq(telegramDeliveryLogs.exchange, filters.exchange));
  if (filters?.interval) conditions.push(eq(telegramDeliveryLogs.interval, filters.interval));
  return db.select().from(telegramDeliveryLogs).where(and(...conditions)).orderBy(desc(telegramDeliveryLogs.createdAt)).limit(clampHistoryLimit(limit, 30));
}

export async function getTelegramDeliveryHistoryPage(userId: number, page = 1, pageSize = 20, filters?: { status?: "pending" | "sent" | "failed"; symbol?: string; exchange?: string; interval?: string }) {
  const db = await getDb();
  if (!db) return { items: [], hasMore: false };
  const conditions = [eq(telegramDeliveryLogs.userId, userId)];
  if (filters?.status) conditions.push(eq(telegramDeliveryLogs.status, filters.status));
  if (filters?.symbol) conditions.push(eq(telegramDeliveryLogs.symbol, filters.symbol));
  if (filters?.exchange) conditions.push(eq(telegramDeliveryLogs.exchange, filters.exchange));
  if (filters?.interval) conditions.push(eq(telegramDeliveryLogs.interval, filters.interval));
  const safePage = Math.max(page, 1);
  const safeSize = clampHistoryLimit(pageSize, 20, 50);
  const rows = await db.select().from(telegramDeliveryLogs).where(and(...conditions)).orderBy(desc(telegramDeliveryLogs.createdAt)).limit(safeSize + 1).offset((safePage - 1) * safeSize);
  return { items: rows.slice(0, safeSize), hasMore: rows.length > safeSize };
}

export async function upsertSignalOutcome(input: { userId: number; snapshotId: number; exchange: string; symbol: string; interval: string; outcome: "take_profit" | "stop_loss" | "expired" | "invalid"; signalCandleOpenTime: number; exitCandleOpenTime?: number; exitPrice?: number; returnPercent: number; candlesObserved: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  await db.insert(signalOutcomes).values({ ...input, exitCandleOpenTime: input.exitCandleOpenTime ?? null, exitPrice: input.exitPrice ?? null }).onDuplicateKeyUpdate({ set: { outcome: input.outcome, exitCandleOpenTime: input.exitCandleOpenTime ?? null, exitPrice: input.exitPrice ?? null, returnPercent: input.returnPercent, candlesObserved: input.candlesObserved, reason: input.reason, evaluatedAt: new Date() } });
}

export async function createPaperTrade(input: { userId: number; exchange: string; symbol: string; interval: string; direction: "Long" | "Short"; entry: number; takeProfit: number; stopLoss: number; currentPrice: number; openedAt: number; sourceSignalKey: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  await db.insert(paperTrades).values(input);
  const rows = await db.select().from(paperTrades).where(and(eq(paperTrades.userId, input.userId), eq(paperTrades.sourceSignalKey, input.sourceSignalKey))).orderBy(desc(paperTrades.createdAt)).limit(1);
  return rows[0];
}

export async function getPaperTrades(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paperTrades).where(eq(paperTrades.userId, userId)).orderBy(desc(paperTrades.createdAt)).limit(clampHistoryLimit(limit, 100, 500));
}

export async function getClosedPaperTradesForDate(userId: number, dateKey: string) {
  const start = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  const end = start + 86_400_000;
  const trades = await getPaperTrades(userId, 500);
  return trades.filter(trade => trade.status !== "open" && trade.closedAt != null && trade.closedAt >= start && trade.closedAt < end);
}

export async function updatePaperTrade(id: number, userId: number, data: { currentPrice: number; status?: "open" | "take_profit" | "stop_loss" | "cancelled"; closedAt?: number | null; exitPrice?: number | null; pnlPercent?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(paperTrades).set(data).where(and(eq(paperTrades.id, id), eq(paperTrades.userId, userId)));
}

export async function createPaperBotAudit(userId: number, action: string, detail: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(paperBotAuditLogs).values({ userId, action, detail });
}

export async function getPaperBotAudit(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(paperBotAuditLogs).where(eq(paperBotAuditLogs.userId, userId)).orderBy(desc(paperBotAuditLogs.createdAt)).limit(clampHistoryLimit(limit, 50, 200));
}

export async function getSignalOutcomes(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signalOutcomes).where(eq(signalOutcomes.userId, userId)).orderBy(desc(signalOutcomes.evaluatedAt)).limit(clampHistoryLimit(limit, 100, 500));
}

export async function saveHeartbeatRun(input: { userId: number; taskUid: string; status: "success" | "failed"; savedCount?: number; alertCount?: number; skippedCount?: number; durationMs: number; error?: string | null; startedAt: Date; finishedAt: Date }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(heartbeatRuns).values({ ...input, savedCount: input.savedCount ?? 0, alertCount: input.alertCount ?? 0, skippedCount: input.skippedCount ?? 0, error: input.error ?? null });
}

export async function getHeartbeatHistoryPage(userId: number, page = 1, pageSize = 20, status?: "success" | "failed") {
  const db = await getDb();
  if (!db) return { items: [], hasMore: false };
  const conditions = [eq(heartbeatRuns.userId, userId)];
  if (status) conditions.push(eq(heartbeatRuns.status, status));
  const safePage = Math.max(page, 1);
  const safeSize = clampHistoryLimit(pageSize, 20, 50);
  const rows = await db.select().from(heartbeatRuns).where(and(...conditions)).orderBy(desc(heartbeatRuns.startedAt)).limit(safeSize + 1).offset((safePage - 1) * safeSize);
  return { items: rows.slice(0, safeSize), hasMore: rows.length > safeSize };
}

export async function getHeartbeatHistory(userId: number, limit = 20, status?: "success" | "failed") {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(heartbeatRuns.userId, userId)];
  if (status) conditions.push(eq(heartbeatRuns.status, status));
  return db.select().from(heartbeatRuns).where(and(...conditions)).orderBy(desc(heartbeatRuns.startedAt)).limit(clampHistoryLimit(limit, 20));
}

export async function getProcessedCandle(userId: number, exchange: string, symbol: string, interval: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(signalProcessingState).where(and(eq(signalProcessingState.userId, userId), eq(signalProcessingState.exchange, exchange), eq(signalProcessingState.symbol, symbol), eq(signalProcessingState.interval, interval))).limit(1);
  return result[0];
}

export async function markProcessedCandle(input: { userId: number; exchange: string; symbol: string; interval: string; candleOpenTime: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(signalProcessingState).values(input).onDuplicateKeyUpdate({ set: { candleOpenTime: input.candleOpenTime, updatedAt: new Date() } });
}

export async function saveSignalSnapshot(input: {
  userId: number; exchange: string; symbol: string; interval: string; label: "Bullish" | "Bearish" | "Neutral"; score: number; price: number;
  entry: number; takeProfit1: number; takeProfit2: number; stopLoss: number; indicators: string; aiSummary?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(signalSnapshots).values(input);
}

export async function getSignalHistory(userId: number, limit = 40, filters?: { symbol?: string; interval?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(signalSnapshots.userId, userId)];
  if (filters?.symbol) conditions.push(like(signalSnapshots.symbol, `%${filters.symbol}%`));
  if (filters?.interval) conditions.push(eq(signalSnapshots.interval, filters.interval));
  return db.select().from(signalSnapshots).where(and(...conditions)).orderBy(desc(signalSnapshots.createdAt)).limit(clampHistoryLimit(limit, 40, 200));
}

export async function getNewsAiSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(newsAiSettings).where(eq(newsAiSettings.userId, userId)).limit(1);
  return result[0];
}

export async function saveNewsAiSettings(userId: number, input: { rssSources: string[]; newsLookbackHours: number; aiIntervals: string[]; enabled: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  await db.insert(newsAiSettings).values({ userId, rssSources: JSON.stringify(input.rssSources), newsLookbackHours: input.newsLookbackHours, aiIntervals: JSON.stringify(input.aiIntervals), enabled: input.enabled }).onDuplicateKeyUpdate({ set: { rssSources: JSON.stringify(input.rssSources), newsLookbackHours: input.newsLookbackHours, aiIntervals: JSON.stringify(input.aiIntervals), enabled: input.enabled, updatedAt: new Date() } });
  return getNewsAiSettings(userId);
}

export type TechnicalAiMode = "workspace_auto" | "workspace_model" | "manual_api";
export const DEFAULT_TECHNICAL_AI_SETTINGS = { mode: "workspace_auto" as const, model: "gpt-5-nano", apiBaseUrl: null, hasApiKey: false, apiKeyMasked: null };

function encryptionKey() {
  if (!ENV.cookieSecret) throw new Error("Server secret chưa sẵn sàng để bảo vệ AI API key");
  return createHash("sha256").update(ENV.cookieSecret).digest();
}

export function encryptTechnicalAiKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptTechnicalAiKey(value: string) {
  const [version, ivText, tagText, dataText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !dataText) throw new Error("AI API key đã lưu có định dạng không hợp lệ");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

export async function getTechnicalAiSettings(userId: number) {
  const db = await getDb();
  if (!db) return { userId, ...DEFAULT_TECHNICAL_AI_SETTINGS };
  const result = await db.select().from(technicalAiSettings).where(eq(technicalAiSettings.userId, userId)).limit(1);
  const row = result[0];
  if (!row) return { userId, ...DEFAULT_TECHNICAL_AI_SETTINGS };
  return { ...row, hasApiKey: Boolean(row.apiKeyCiphertext), apiKeyMasked: row.apiKeyCiphertext ? "••••••••" : null, apiKeyCiphertext: undefined };
}

export async function getTechnicalAiSecret(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(technicalAiSettings).where(eq(technicalAiSettings.userId, userId)).limit(1);
  return result[0]?.apiKeyCiphertext ? decryptTechnicalAiKey(result[0].apiKeyCiphertext) : undefined;
}

export async function saveTechnicalAiSettings(userId: number, input: { mode: TechnicalAiMode; model: string; apiBaseUrl?: string | null; apiKey?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const current = await db.select().from(technicalAiSettings).where(eq(technicalAiSettings.userId, userId)).limit(1);
  const apiKeyCiphertext = input.apiKey === undefined ? current[0]?.apiKeyCiphertext ?? null : input.apiKey ? encryptTechnicalAiKey(input.apiKey) : null;
  const values = { userId, mode: input.mode, model: input.model, apiBaseUrl: input.apiBaseUrl ?? null, apiKeyCiphertext };
  await db.insert(technicalAiSettings).values(values).onDuplicateKeyUpdate({ set: { mode: values.mode, model: values.model, apiBaseUrl: values.apiBaseUrl, apiKeyCiphertext: values.apiKeyCiphertext, updatedAt: new Date() } });
  return getTechnicalAiSettings(userId);
}

export async function saveNewsItem(userId: number, input: { symbol: string; source: string; url: string; title: string; summary?: string; publishedAt: number }) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(newsItems).where(and(eq(newsItems.userId, userId), eq(newsItems.url, input.url), eq(newsItems.symbol, input.symbol))).limit(1);
  if (!existing[0]) await db.insert(newsItems).values({ userId, ...input, summary: input.summary ?? null });
}

export async function saveAiAnalysis(userId: number, input: { snapshotId?: number; symbol: string; interval: string; analysis: string; newsItemIds?: number[] }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(aiAnalyses).values({ userId, snapshotId: input.snapshotId ?? null, symbol: input.symbol, interval: input.interval, analysis: input.analysis, newsItemIds: JSON.stringify(input.newsItemIds ?? []) });
}

export async function getNewsHistory(userId: number, limit = 50, symbol?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(newsItems.userId, userId)];
  if (symbol) conditions.push(like(newsItems.symbol, `%${symbol}%`));
  return db.select().from(newsItems).where(and(...conditions)).orderBy(desc(newsItems.publishedAt)).limit(clampHistoryLimit(limit, 50, 200));
}

export async function getAiHistory(userId: number, limit = 50, filters?: { symbol?: string; interval?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(aiAnalyses.userId, userId)];
  if (filters?.symbol) conditions.push(like(aiAnalyses.symbol, `%${filters.symbol}%`));
  if (filters?.interval) conditions.push(eq(aiAnalyses.interval, filters.interval));
  return db.select().from(aiAnalyses).where(and(...conditions)).orderBy(desc(aiAnalyses.createdAt)).limit(clampHistoryLimit(limit, 50, 200));
}

export async function getNewsHistoryPage(userId: number, page = 1, pageSize = 20, symbol?: string) {
  const db = await getDb();
  if (!db) return { items: [], hasMore: false };
  const conditions = [eq(newsItems.userId, userId)];
  if (symbol) conditions.push(like(newsItems.symbol, `%${symbol}%`));
  const safeSize = clampHistoryLimit(pageSize, 20, 50);
  const rows = await db.select().from(newsItems).where(and(...conditions)).orderBy(desc(newsItems.publishedAt)).limit(safeSize + 1).offset((Math.max(page, 1) - 1) * safeSize);
  return { items: rows.slice(0, safeSize), hasMore: rows.length > safeSize };
}

export async function getAiHistoryPage(userId: number, page = 1, pageSize = 20, filters?: { symbol?: string; interval?: string }) {
  const db = await getDb();
  if (!db) return { items: [], hasMore: false };
  const conditions = [eq(aiAnalyses.userId, userId)];
  if (filters?.symbol) conditions.push(like(aiAnalyses.symbol, `%${filters.symbol}%`));
  if (filters?.interval) conditions.push(eq(aiAnalyses.interval, filters.interval));
  const safeSize = clampHistoryLimit(pageSize, 20, 50);
  const rows = await db.select().from(aiAnalyses).where(and(...conditions)).orderBy(desc(aiAnalyses.createdAt)).limit(safeSize + 1).offset((Math.max(page, 1) - 1) * safeSize);
  return { items: rows.slice(0, safeSize), hasMore: rows.length > safeSize };
}

export async function getSignalSnapshotById(userId: number, id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(signalSnapshots).where(and(eq(signalSnapshots.userId, userId), eq(signalSnapshots.id, id))).limit(1);
  return result[0];
}

export async function getRecentReanalysis(userId: number, snapshotId: number, windowMs = 15 * 60 * 1000) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(aiReanalysisRequests).where(and(eq(aiReanalysisRequests.userId, userId), eq(aiReanalysisRequests.snapshotId, snapshotId), gt(aiReanalysisRequests.requestedAt, new Date(Date.now() - windowMs)))).orderBy(desc(aiReanalysisRequests.requestedAt)).limit(1);
  return result[0];
}

export async function createReanalysisRequest(userId: number, snapshotId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  const result = await db.insert(aiReanalysisRequests).values({ userId, snapshotId, status: "started" });
  return Number(result[0].insertId);
}

export async function updateReanalysisRequest(id: number, data: { status: "started" | "completed" | "failed"; error?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(aiReanalysisRequests).set({ ...data, completedAt: data.status === "started" ? null : new Date() }).where(eq(aiReanalysisRequests.id, id));
}

export async function getLastSignal(userId: number, exchange: string, symbol: string, interval: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(signalSnapshots).where(and(eq(signalSnapshots.userId, userId), eq(signalSnapshots.exchange, exchange), eq(signalSnapshots.symbol, symbol), eq(signalSnapshots.interval, interval))).orderBy(desc(signalSnapshots.createdAt)).limit(1);
  return result[0];
}

export function parseRiskSnapshot(row: { indicators: string; createdAt: Date }) {
  try {
    const payload = JSON.parse(row.indicators) as { risk?: { score?: number }; candleOpenTime?: number; candleClosedAt?: number };
    const score = payload.risk?.score;
    if (typeof score !== "number" || !Number.isFinite(score)) return null;
    return { candleOpenTime: payload.candleOpenTime ?? row.createdAt.getTime(), candleClosedAt: payload.candleClosedAt ?? row.createdAt.getTime(), score: Math.max(0, Math.min(100, score)) };
  } catch {
    return null;
  }
}

export function groupRiskSnapshots(rows: Array<{ exchange: string; symbol: string; interval: string; indicators: string; createdAt: Date }>, limitPerKey = 24) {
  const grouped: Record<string, Array<{ candleOpenTime: number; candleClosedAt: number; score: number }>> = {};
  for (const row of rows) {
    const point = parseRiskSnapshot(row);
    if (!point) continue;
    const key = `${row.exchange}:${row.symbol}:${row.interval}`;
    const values = grouped[key] ?? (grouped[key] = []);
    if (values.length >= Math.min(Math.max(limitPerKey, 2), 60)) continue;
    values.push(point);
  }
  for (const key of Object.keys(grouped)) grouped[key].reverse();
  return grouped;
}

export async function getRiskHistories(userId: number, limitPerKey = 24) {
  const db = await getDb();
  if (!db) return {};
  const rows = await db.select().from(signalSnapshots).where(eq(signalSnapshots.userId, userId)).orderBy(desc(signalSnapshots.createdAt)).limit(500);
  return groupRiskSnapshots(rows, limitPerKey);
}

export async function getRiskHistory(userId: number, exchange: string, symbol: string, interval: string, limit = 24) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(signalSnapshots)
    .where(and(eq(signalSnapshots.userId, userId), eq(signalSnapshots.exchange, exchange), eq(signalSnapshots.symbol, symbol), eq(signalSnapshots.interval, interval)))
    .orderBy(desc(signalSnapshots.createdAt)).limit(Math.min(Math.max(limit, 1), 60));
  return rows.map(row => {
    const point = parseRiskSnapshot(row);
    return point ? { ...point, createdAt: row.createdAt } : null;
  }).filter((item): item is { candleOpenTime: number; candleClosedAt: number; score: number; createdAt: Date } => Boolean(item)).reverse();
}

export function parseConfidenceSnapshot(row: { label: "Bullish" | "Bearish" | "Neutral"; indicators: string; createdAt: Date }) {
  try {
    const payload = JSON.parse(row.indicators) as { confidence?: number; candleOpenTime?: number; candleClosedAt?: number; signalQuality?: { penalty?: number; isTradeEligible?: boolean } };
    if (typeof payload.confidence !== "number" || !Number.isFinite(payload.confidence)) return null;
    const penalty = typeof payload.signalQuality?.penalty === "number" && Number.isFinite(payload.signalQuality.penalty) ? Math.max(0, Math.min(100, payload.signalQuality.penalty)) : null;
    return { candleOpenTime: payload.candleOpenTime ?? row.createdAt.getTime(), candleClosedAt: payload.candleClosedAt ?? row.createdAt.getTime(), confidence: Math.max(0, Math.min(100, payload.confidence)), penalty, isTradeEligible: payload.signalQuality?.isTradeEligible ?? null, label: row.label };
  } catch {
    return null;
  }
}

export async function getConfidenceHistory(userId: number, exchange: string, symbol: string, interval: string, limit = 36) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(signalSnapshots)
    .where(and(eq(signalSnapshots.userId, userId), eq(signalSnapshots.exchange, exchange), eq(signalSnapshots.symbol, symbol), eq(signalSnapshots.interval, interval)))
    .orderBy(desc(signalSnapshots.createdAt)).limit(Math.min(Math.max(limit, 2), 60));
  return rows.map(row => {
    const point = parseConfidenceSnapshot(row);
    return point ? { ...point, createdAt: row.createdAt } : null;
  }).filter((item): item is { candleOpenTime: number; candleClosedAt: number; confidence: number; penalty: number | null; isTradeEligible: boolean | null; label: "Bullish" | "Bearish" | "Neutral"; createdAt: Date } => Boolean(item)).reverse();
}

export async function getConfidenceEarlyWarnings(userId: number, limit = 24) {
  const db = await getDb();
  if (!db) return [];
  const thresholds = await getMomentumSettings(userId);
  const rows = await db.select().from(signalSnapshots).where(eq(signalSnapshots.userId, userId)).orderBy(desc(signalSnapshots.createdAt)).limit(500);
  const groups = new Map<string, { exchange: string; symbol: string; interval: string; points: Array<ReturnType<typeof parseConfidenceSnapshot>> }>();
  for (const row of rows) {
    const point = parseConfidenceSnapshot(row);
    if (!point) continue;
    const key = `${row.exchange}:${row.symbol}:${row.interval}`;
    const group = groups.get(key) ?? { exchange: row.exchange, symbol: row.symbol, interval: row.interval, points: [] };
    if (group.points.length < 3) group.points.push(point);
    groups.set(key, group);
  }
  return Array.from(groups.values()).map(group => {
    const points = group.points.filter((point): point is NonNullable<typeof point> => Boolean(point)).sort((a, b) => a.candleClosedAt - b.candleClosedAt);
    const momentum = classifyConfidenceMomentum(points, thresholds);
    return { exchange: group.exchange, symbol: group.symbol, interval: group.interval, observations: points.length, thresholds: { criticalDropThreshold: thresholds.criticalDropThreshold, deterioratingDropThreshold: thresholds.deterioratingDropThreshold }, momentum };
  }).filter(item => item.momentum.status === "critical" || item.momentum.status === "deteriorating").sort((a, b) => (a.momentum.status === "critical" ? -1 : 1) - (b.momentum.status === "critical" ? -1 : 1)).slice(0, Math.min(Math.max(limit, 1), 30));
}
