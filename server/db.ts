import { drizzle } from "drizzle-orm/mysql2";
import { and, desc, eq } from "drizzle-orm";
import { heartbeatRuns, InsertUser, signalOutcomes, signalProcessingState, signalSnapshots, telegramAlertRules, telegramDeliveryLogs, telegramSettings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

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

export async function getTelegramSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(telegramSettings).where(eq(telegramSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function saveTelegramSettings(userId: number, data: { botToken: string; chatId: string; alertThreshold: number; enabled: number }, scheduleCronTaskUid?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database chưa sẵn sàng");
  await db.insert(telegramSettings).values({ userId, ...data, scheduleCronTaskUid }).onDuplicateKeyUpdate({ set: { ...data, ...(scheduleCronTaskUid ? { scheduleCronTaskUid } : {}), updatedAt: new Date() } });
  return getTelegramSettings(userId);
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

export async function getSignalHistory(userId: number, limit = 40) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signalSnapshots).where(eq(signalSnapshots.userId, userId)).orderBy(desc(signalSnapshots.createdAt)).limit(limit);
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
