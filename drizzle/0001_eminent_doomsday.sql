CREATE TABLE `signal_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`label` enum('Bullish','Bearish','Neutral') NOT NULL,
	`score` int NOT NULL,
	`price` double NOT NULL,
	`entry` double NOT NULL,
	`takeProfit1` double NOT NULL,
	`takeProfit2` double NOT NULL,
	`stopLoss` double NOT NULL,
	`indicators` text NOT NULL,
	`aiSummary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signal_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`botToken` varchar(255) NOT NULL,
	`chatId` varchar(100) NOT NULL,
	`alertThreshold` int NOT NULL DEFAULT 50,
	`enabled` int NOT NULL DEFAULT 1,
	`scheduleCronTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `signal_snapshots_lookup_idx` ON `signal_snapshots` (`userId`,`symbol`,`interval`,`createdAt`);--> statement-breakpoint
CREATE INDEX `telegram_settings_task_uid_idx` ON `telegram_settings` (`scheduleCronTaskUid`);