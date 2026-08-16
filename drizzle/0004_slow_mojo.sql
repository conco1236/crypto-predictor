CREATE TABLE `heartbeat_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskUid` varchar(65) NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`savedCount` int NOT NULL DEFAULT 0,
	`alertCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`durationMs` int NOT NULL DEFAULT 0,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `heartbeat_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_delivery_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskUid` varchar(65),
	`exchange` varchar(20) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`candleOpenTime` double NOT NULL,
	`candleClosedAt` double NOT NULL,
	`label` enum('Bullish','Bearish','Neutral') NOT NULL,
	`score` int NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`telegramMessageId` varchar(64),
	`lastError` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_delivery_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_delivery_candle_unique` UNIQUE(`userId`,`exchange`,`symbol`,`interval`,`candleOpenTime`)
);
--> statement-breakpoint
CREATE INDEX `heartbeat_runs_lookup_idx` ON `heartbeat_runs` (`userId`,`taskUid`,`startedAt`);--> statement-breakpoint
CREATE INDEX `telegram_delivery_lookup_idx` ON `telegram_delivery_logs` (`userId`,`status`,`createdAt`);