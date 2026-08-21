import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  refreshSettings,
  signalHistory,
  signalSnapshots,
  telegramDeliveries,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import type { MarketSymbol, SignalSnapshot, Timeframe } from "./signal-engine";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

function snapshotValues(signal: SignalSnapshot) {
  return {
    symbol: signal.symbol,
    timeframe: signal.timeframe,
    candleOpenTime: signal.candleOpenTime,
    candleCloseTime: signal.candleCloseTime,
    expectedNextCandleCloseTime: signal.freshness.expectedNextCandleCloseTime,
    currentPrice: String(signal.currentPrice),
    status: signal.status,
    riskScore: signal.riskScore,
    confluenceScore: signal.confluenceScore,
    stale: signal.freshness.stale,
    observedAt: new Date(signal.freshness.observedAt),
    snapshot: signal as unknown as Record<string, unknown>,
  };
}

export async function persistSignalSnapshots(signals: SignalSnapshot[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable while persisting market signals");
  for (const signal of signals) {
    const values = snapshotValues(signal);
    await db.insert(signalSnapshots).values(values).onDuplicateKeyUpdate({
      set: {
        candleOpenTime: values.candleOpenTime,
        candleCloseTime: values.candleCloseTime,
        expectedNextCandleCloseTime: values.expectedNextCandleCloseTime,
        currentPrice: values.currentPrice,
        status: values.status,
        riskScore: values.riskScore,
        confluenceScore: values.confluenceScore,
        stale: values.stale,
        observedAt: values.observedAt,
        snapshot: values.snapshot,
      },
    });
    await db.insert(signalHistory).values({
      symbol: values.symbol,
      timeframe: values.timeframe,
      candleOpenTime: values.candleOpenTime,
      candleCloseTime: values.candleCloseTime,
      status: values.status,
      riskScore: values.riskScore,
      confluenceScore: values.confluenceScore,
      stale: values.stale,
      snapshot: values.snapshot,
    }).onDuplicateKeyUpdate({
      set: {
        status: values.status,
        riskScore: values.riskScore,
        confluenceScore: values.confluenceScore,
        stale: values.stale,
        snapshot: values.snapshot,
      },
    });
  }
}

export async function getLatestSignalSnapshots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(signalSnapshots).orderBy(signalSnapshots.symbol, signalSnapshots.timeframe);
}

export async function getSignalHistory(input: { symbol?: MarketSymbol; timeframe?: Timeframe; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 200);
  const conditions = [];
  if (input.symbol) conditions.push(eq(signalHistory.symbol, input.symbol));
  if (input.timeframe) conditions.push(eq(signalHistory.timeframe, input.timeframe));
  const query = db.select().from(signalHistory).orderBy(desc(signalHistory.candleCloseTime)).limit(limit);
  if (conditions.length === 0) return query;
  return query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
}

export async function getMarketRefreshSetting() {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(refreshSettings).where(eq(refreshSettings.scope, "market")).limit(1);
  return rows[0];
}

export async function markMarketRefresh(input: {
  status: "started" | "success" | "failed";
  count?: number;
  error?: string | null;
  scheduleCronTaskUid?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable while updating refresh health");
  const now = new Date();
  const base = {
    scope: "market",
    enabled: true,
    lastRunAt: now,
    lastSuccessAt: input.status === "success" ? now : null,
    lastError: input.status === "failed" ? input.error ?? "Unknown refresh error" : null,
    refreshedSignals: input.status === "success" ? input.count ?? 0 : 0,
    scheduleCronTaskUid: input.scheduleCronTaskUid ?? null,
  };
  await db.insert(refreshSettings).values(base).onDuplicateKeyUpdate({
    set: {
      lastRunAt: now,
      ...(input.status === "success" ? { lastSuccessAt: now, lastError: null, refreshedSignals: input.count ?? 0 } : {}),
      ...(input.status === "failed" ? { lastError: input.error ?? "Unknown refresh error" } : {}),
      ...(input.scheduleCronTaskUid !== undefined ? { scheduleCronTaskUid: input.scheduleCronTaskUid } : {}),
    },
  });
}

export async function reserveTelegramUpdate(input: { updateId: number; chatId: string; command: string; symbol: MarketSymbol | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable while reserving Telegram update");
  try {
    await db.insert(telegramDeliveries).values({
      telegramUpdateId: input.updateId,
      chatId: input.chatId,
      command: input.command,
      symbol: input.symbol,
      deliveryStatus: "processing",
    });
    return true;
  } catch (error) {
    if (isDuplicateTelegramUpdateError(error)) return false;
    throw error;
  }
}

export function isDuplicateTelegramUpdateError(error: unknown): boolean {
  return String(error).includes("Duplicate");
}

export async function completeTelegramDelivery(updateId: number, input: { status: "sent" | "ignored" | "failed"; error?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable while completing Telegram delivery");
  await db.update(telegramDeliveries).set({
    deliveryStatus: input.status,
    errorDetail: input.error ?? null,
    completedAt: new Date(),
  }).where(eq(telegramDeliveries.telegramUpdateId, updateId));
}
