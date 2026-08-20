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
  qualityAlertThreshold: int("qualityAlertThreshold").default(20).notNull(),
  sendMode: mysqlEnum("sendMode", ["all_candles", "strong_only"]).default("all_candles").notNull(),
  enabled: int("enabled").default(1).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  paperReportEnabled: int("paperReportEnabled").default(0).notNull(),
  paperReportCronTaskUid: varchar("paperReportCronTaskUid", { length: 65 }),
  paperReportLastDate: varchar("paperReportLastDate", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userUnique: uniqueIndex("telegram_settings_user_unique").on(table.userId), taskIndex: index("telegram_settings_task_uid_idx").on(table.scheduleCronTaskUid), paperReportTaskIndex: index("telegram_settings_paper_report_task_idx").on(table.paperReportCronTaskUid) }));

export const telegramAlertRules = mysqlTable("telegram_alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull().default("*"),
  exchange: varchar("exchange", { length: 20 }).notNull().default("*"),
  interval: varchar("interval", { length: 10 }).notNull().default("*"),
  alertThreshold: int("alertThreshold").default(50).notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ ruleUnique: uniqueIndex("telegram_alert_rules_scope_unique").on(table.userId, table.symbol, table.exchange, table.interval), userIndex: index("telegram_alert_rules_user_idx").on(table.userId, table.updatedAt) }));

export const telegramQualityThresholdOverrides = mysqlTable("telegram_quality_threshold_overrides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  threshold: int("threshold").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userExchangeUnique: uniqueIndex("telegram_quality_threshold_user_exchange_unique").on(table.userId, table.exchange), userIndex: index("telegram_quality_threshold_user_idx").on(table.userId, table.updatedAt) }));

export const telegramQualityThresholdHistory = mysqlTable("telegram_quality_threshold_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exchange: varchar("exchange", { length: 20 }),
  previousThreshold: int("previousThreshold"),
  nextThreshold: int("nextThreshold").notNull(),
  source: varchar("source", { length: 20 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userHistoryIndex: index("telegram_quality_threshold_history_user_idx").on(table.userId, table.createdAt) }));

export const momentumSettings = mysqlTable("momentum_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  criticalDropThreshold: int("criticalDropThreshold").default(15).notNull(),
  deterioratingDropThreshold: int("deterioratingDropThreshold").default(8).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userUnique: uniqueIndex("momentum_settings_user_unique").on(table.userId) }));

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
  message: text("message"),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).default("pending").notNull(),
  attempts: int("attempts").default(0).notNull(),
  telegramMessageId: varchar("telegramMessageId", { length: 64 }),
  lastError: text("lastError"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ deliveryUnique: uniqueIndex("telegram_delivery_candle_unique").on(table.userId, table.exchange, table.symbol, table.interval, table.candleOpenTime), deliveryLookup: index("telegram_delivery_lookup_idx").on(table.userId, table.status, table.createdAt) }));

export const signalOutcomes = mysqlTable("signal_outcomes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotId: int("snapshotId").notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  outcome: mysqlEnum("outcome", ["take_profit", "stop_loss", "expired", "invalid"]).notNull(),
  signalCandleOpenTime: double("signalCandleOpenTime").notNull(),
  exitCandleOpenTime: double("exitCandleOpenTime"),
  exitPrice: double("exitPrice"),
  returnPercent: double("returnPercent").default(0).notNull(),
  candlesObserved: int("candlesObserved").default(0).notNull(),
  reason: text("reason"),
  evaluatedAt: timestamp("evaluatedAt").defaultNow().notNull(),
}, table => ({ outcomeUnique: uniqueIndex("signal_outcomes_snapshot_unique").on(table.userId, table.snapshotId), lookupIndex: index("signal_outcomes_lookup_idx").on(table.userId, table.exchange, table.symbol, table.interval, table.evaluatedAt) }));

export const newsAiSettings = mysqlTable("news_ai_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rssSources: text("rssSources").notNull(),
  newsLookbackHours: int("newsLookbackHours").default(6).notNull(),
  aiIntervals: text("aiIntervals").notNull(),
  enabled: int("enabled").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ settingsUserUnique: uniqueIndex("news_ai_settings_user_unique").on(table.userId) }));

export const newsItems = mysqlTable("news_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  source: varchar("source", { length: 120 }).notNull(),
  url: varchar("url", { length: 1000 }).notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  publishedAt: double("publishedAt").notNull(),
  collectedAt: timestamp("collectedAt").defaultNow().notNull(),
}, table => ({ newsLookup: index("news_items_lookup_idx").on(table.userId, table.symbol, table.publishedAt) }));

export const aiAnalyses = mysqlTable("ai_analyses", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotId: int("snapshotId"),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  analysis: text("analysis").notNull(),
  newsItemIds: text("newsItemIds"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ aiLookup: index("ai_analyses_lookup_idx").on(table.userId, table.symbol, table.interval, table.createdAt) }));

export const aiReanalysisRequests = mysqlTable("ai_reanalysis_requests", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  snapshotId: int("snapshotId").notNull(),
  status: mysqlEnum("status", ["started", "completed", "failed"]).notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  error: text("error"),
}, table => ({ reanalysisLookup: index("ai_reanalysis_lookup_idx").on(table.userId, table.snapshotId, table.requestedAt) }));

export const paperTrades = mysqlTable("paper_trades", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exchange: varchar("exchange", { length: 20 }).notNull(),
  symbol: varchar("symbol", { length: 20 }).notNull(),
  interval: varchar("interval", { length: 10 }).notNull(),
  direction: mysqlEnum("direction", ["Long", "Short"]).notNull(),
  entry: double("entry").notNull(),
  takeProfit: double("takeProfit").notNull(),
  stopLoss: double("stopLoss").notNull(),
  currentPrice: double("currentPrice").notNull(),
  status: mysqlEnum("status", ["open", "take_profit", "stop_loss", "cancelled"]).default("open").notNull(),
  openedAt: double("openedAt").notNull(),
  closedAt: double("closedAt"),
  exitPrice: double("exitPrice"),
  pnlPercent: double("pnlPercent").default(0).notNull(),
  sourceSignalKey: varchar("sourceSignalKey", { length: 120 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ paperTradeLookup: index("paper_trades_lookup_idx").on(table.userId, table.status, table.createdAt) }));

export const paperBotAuditLogs = mysqlTable("paper_bot_audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 60 }).notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ auditLookup: index("paper_bot_audit_lookup_idx").on(table.userId, table.createdAt) }));

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
export type TelegramAlertRule = typeof telegramAlertRules.$inferSelect;
export type TelegramQualityThresholdOverride = typeof telegramQualityThresholdOverrides.$inferSelect;
export type TelegramQualityThresholdHistory = typeof telegramQualityThresholdHistory.$inferSelect;
export type MomentumSetting = typeof momentumSettings.$inferSelect;
export type SignalSnapshot = typeof signalSnapshots.$inferSelect;
export type TelegramDeliveryLog = typeof telegramDeliveryLogs.$inferSelect;
export type HeartbeatRun = typeof heartbeatRuns.$inferSelect;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type PaperBotAuditLog = typeof paperBotAuditLogs.$inferSelect;
export type SignalOutcome = typeof signalOutcomes.$inferSelect;
export type NewsAiSetting = typeof newsAiSettings.$inferSelect;
export type NewsItem = typeof newsItems.$inferSelect;
export type AiAnalysis = typeof aiAnalyses.$inferSelect;
export type AiReanalysisRequest = typeof aiReanalysisRequests.$inferSelect;
