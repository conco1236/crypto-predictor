import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const marketSymbols = ["BTCUSDT", "ETHUSDT"] as const;
export const marketTimeframes = ["1m", "15m", "1h", "4h", "1d"] as const;
export const signalStatuses = ["Bullish", "Bearish", "Neutral", "No Trade"] as const;
export const riskScores = ["Low", "Medium", "High"] as const;

export const signalSnapshots = mysqlTable(
  "signal_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    symbol: mysqlEnum("symbol", marketSymbols).notNull(),
    timeframe: mysqlEnum("timeframe", marketTimeframes).notNull(),
    candleOpenTime: bigint("candleOpenTime", { mode: "number" }).notNull(),
    candleCloseTime: bigint("candleCloseTime", { mode: "number" }).notNull(),
    expectedNextCandleCloseTime: bigint("expectedNextCandleCloseTime", { mode: "number" }).notNull(),
    currentPrice: varchar("currentPrice", { length: 32 }).notNull(),
    status: mysqlEnum("status", signalStatuses).notNull(),
    riskScore: mysqlEnum("riskScore", riskScores).notNull(),
    confluenceScore: int("confluenceScore").notNull(),
    stale: boolean("stale").notNull().default(false),
    observedAt: timestamp("observedAt").defaultNow().notNull(),
    snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  },
  table => [
    uniqueIndex("signal_snapshot_symbol_timeframe_unique").on(table.symbol, table.timeframe),
    index("signal_snapshot_observed_at_idx").on(table.observedAt),
  ]
);

export const signalHistory = mysqlTable(
  "signal_history",
  {
    id: int("id").autoincrement().primaryKey(),
    symbol: mysqlEnum("symbol", marketSymbols).notNull(),
    timeframe: mysqlEnum("timeframe", marketTimeframes).notNull(),
    candleOpenTime: bigint("candleOpenTime", { mode: "number" }).notNull(),
    candleCloseTime: bigint("candleCloseTime", { mode: "number" }).notNull(),
    status: mysqlEnum("status", signalStatuses).notNull(),
    riskScore: mysqlEnum("riskScore", riskScores).notNull(),
    confluenceScore: int("confluenceScore").notNull(),
    stale: boolean("stale").notNull().default(false),
    recordedAt: timestamp("recordedAt").defaultNow().notNull(),
    snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  },
  table => [
    uniqueIndex("signal_history_candle_unique").on(table.symbol, table.timeframe, table.candleOpenTime),
    index("signal_history_symbol_timeframe_idx").on(table.symbol, table.timeframe, table.candleCloseTime),
  ]
);

export const refreshSettings = mysqlTable("refresh_settings", {
  id: int("id").autoincrement().primaryKey(),
  scope: varchar("scope", { length: 32 }).notNull().unique(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("lastRunAt"),
  lastSuccessAt: timestamp("lastSuccessAt"),
  lastError: text("lastError"),
  refreshedSignals: int("refreshedSignals").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const telegramDeliveries = mysqlTable(
  "telegram_deliveries",
  {
    id: int("id").autoincrement().primaryKey(),
    telegramUpdateId: bigint("telegramUpdateId", { mode: "number" }).notNull(),
    chatId: varchar("chatId", { length: 64 }).notNull(),
    command: varchar("command", { length: 16 }).notNull(),
    symbol: mysqlEnum("symbol", marketSymbols),
    deliveryStatus: varchar("deliveryStatus", { length: 24 }).notNull(),
    errorDetail: text("errorDetail"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [
    uniqueIndex("telegram_delivery_update_unique").on(table.telegramUpdateId),
    index("telegram_delivery_created_at_idx").on(table.createdAt),
  ]
);

export type SignalSnapshotRow = typeof signalSnapshots.$inferSelect;
export type SignalHistoryRow = typeof signalHistory.$inferSelect;
