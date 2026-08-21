CREATE TABLE `refresh_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scope` varchar(32) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`enabled` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`lastSuccessAt` timestamp,
	`lastError` text,
	`refreshedSignals` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `refresh_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `refresh_settings_scope_unique` UNIQUE(`scope`)
);
--> statement-breakpoint
CREATE TABLE `signal_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` enum('BTCUSDT','ETHUSDT') NOT NULL,
	`timeframe` enum('1m','15m','1h','4h','1d') NOT NULL,
	`candleOpenTime` bigint NOT NULL,
	`candleCloseTime` bigint NOT NULL,
	`status` enum('Bullish','Bearish','Neutral','No Trade') NOT NULL,
	`riskScore` enum('Low','Medium','High') NOT NULL,
	`confluenceScore` int NOT NULL,
	`stale` boolean NOT NULL DEFAULT false,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`snapshot` json NOT NULL,
	CONSTRAINT `signal_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_history_candle_unique` UNIQUE(`symbol`,`timeframe`,`candleOpenTime`)
);
--> statement-breakpoint
CREATE TABLE `signal_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`symbol` enum('BTCUSDT','ETHUSDT') NOT NULL,
	`timeframe` enum('1m','15m','1h','4h','1d') NOT NULL,
	`candleOpenTime` bigint NOT NULL,
	`candleCloseTime` bigint NOT NULL,
	`expectedNextCandleCloseTime` bigint NOT NULL,
	`currentPrice` varchar(32) NOT NULL,
	`status` enum('Bullish','Bearish','Neutral','No Trade') NOT NULL,
	`riskScore` enum('Low','Medium','High') NOT NULL,
	`confluenceScore` int NOT NULL,
	`stale` boolean NOT NULL DEFAULT false,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`snapshot` json NOT NULL,
	CONSTRAINT `signal_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_snapshot_symbol_timeframe_unique` UNIQUE(`symbol`,`timeframe`)
);
--> statement-breakpoint
CREATE TABLE `telegram_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`telegramUpdateId` bigint NOT NULL,
	`chatId` varchar(64) NOT NULL,
	`command` varchar(16) NOT NULL,
	`symbol` enum('BTCUSDT','ETHUSDT'),
	`deliveryStatus` varchar(24) NOT NULL,
	`errorDetail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `telegram_deliveries_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_delivery_update_unique` UNIQUE(`telegramUpdateId`)
);
--> statement-breakpoint
CREATE INDEX `signal_history_symbol_timeframe_idx` ON `signal_history` (`symbol`,`timeframe`,`candleCloseTime`);--> statement-breakpoint
CREATE INDEX `signal_snapshot_observed_at_idx` ON `signal_snapshots` (`observedAt`);--> statement-breakpoint
CREATE INDEX `telegram_delivery_created_at_idx` ON `telegram_deliveries` (`createdAt`);