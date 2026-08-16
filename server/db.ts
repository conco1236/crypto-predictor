import { drizzle } from "drizzle-orm/mysql2";
import { and, desc, eq } from "drizzle-orm";
import { InsertUser, signalProcessingState, signalSnapshots, telegramSettings, users } from "../drizzle/schema";
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
