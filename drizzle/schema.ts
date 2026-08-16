import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, index, uniqueIndex } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const telegramSettings = mysqlTable("telegram_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  botToken: varchar("botToken", { length: 255 }).notNull(),
  chatId: varchar("chatId", { length: 100 }).notNull(),
  alertThreshold: int("alertThreshold").default(50).notNull(),
  enabled: int("enabled").default(1).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userUnique: uniqueIndex("telegram_settings_user_unique").on(table.userId), taskIndex: index("telegram_settings_task_uid_idx").on(table.scheduleCronTaskUid) }));

export const signalProcessingState = mysqlTable("signal_processing_state", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  candleOpenTime: double("candleOpenTime").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ uniqueState: uniqueIndex("signal_processing_state_unique").on(table.userId, table.exchange, table.symbol, table.interval) }));

export const telegramDeliveryLogs = mysqlTable("telegram_delivery_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskUid: varchar("taskUid", { length: 65 }),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  candleOpenTime: double("candleOpenTime").notNull(),
  candleClosedAt: double("candleClosedAt").notNull(),
  label: mysqlEnum("label", ["Bullish", "Bearish", "Neutral"]).notNull(),
  score: int("score").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  telegramMessageId: varchar("telegramMessageId", { length: 64 }),
  lastError: text("lastError"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ deliveryUnique: uniqueIndex("telegram_delivery_candle_unique").on(table.userId, table.exchange, table.symbol, table.interval, table.candleOpenTime), deliveryLookup: index("telegram_delivery_lookup_idx").on(table.userId, table.status, table.createdAt) }));

export const heartbeatRuns = mysqlTable("heartbeat_runs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  taskUid: varchar("taskUid", { length: 65 }).notNull(),
  status: mysqlEnum("status", ["success", "failed"]).notNull(),
  savedCount: int("savedCount").default(0).notNull(),
  alertCount: int("alertCount").default(0).notNull(),
  skippedCount: int("skippedCount").default(0).notNull(),
  durationMs: int("durationMs").default(0).notNull(),
  error: text("error"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt").defaultNow().notNull(),
}, table => ({ heartbeatLookup: index("heartbeat_runs_lookup_idx").on(table.userId, table.taskUid, table.startedAt) }));

export const signalSnapshots = mysqlTable("signal_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull().default("Binance"),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  label: mysqlEnum("label", ["Bullish", "Bearish", "Neutral"]).notNull(),
  score: int("score").notNull(),
  price: double("price").notNull(),
  entry: double("entry").notNull(),
  takeProfit1: double("takeProfit1").notNull(),
  takeProfit2: double("takeProfit2").notNull(),
  stopLoss: double("stopLoss").notNull(),
  indicators: text("indicators").notNull(),
  aiSummary: text("aiSummary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ lookupIndex: index("signal_snapshots_lookup_idx").on(table.userId, table.symbol, table.interval, table.createdAt) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type TelegramSetting = typeof telegramSettings.$inferSelect;
export type SignalSnapshot = typeof signalSnapshots.$inferSelect;
export type TelegramDeliveryLog = typeof telegramDeliveryLogs.$inferSelect;
export type HeartbeatRun = typeof heartbeatRuns.$inferSelect;
