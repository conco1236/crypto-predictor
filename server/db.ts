import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, signalSnapshots, telegramSettings, users } from "../drizzle/schema";
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

export async function saveSignalSnapshot(input: {
  userId: number; symbol: string; interval: string; label: "Bullish" | "Bearish" | "Neutral"; score: number; price: number;
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

export async function getLastSignal(userId: number, symbol: string, interval: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(signalSnapshots).where(and(eq(signalSnapshots.userId, userId), eq(signalSnapshots.symbol, symbol), eq(signalSnapshots.interval, interval))).orderBy(desc(signalSnapshots.createdAt)).limit(1);
  return result[0];
}
