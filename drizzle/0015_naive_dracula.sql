CREATE TABLE `momentum_critical_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskUid` varchar(65),
	`exchange` varchar(20) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`candleOpenTime` double NOT NULL,
	`candleClosedAt` double NOT NULL,
	`previousConfidence` double,
	`confidence` double NOT NULL,
	`delta` double,
	`reason` text NOT NULL,
	`message` text,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`telegramMessageId` varchar(64),
	`lastError` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `momentum_critical_alerts_id` PRIMARY KEY(`id`),
	CONSTRAINT `momentum_critical_alert_candle_unique` UNIQUE(`userId`,`exchange`,`symbol`,`interval`,`candleOpenTime`)
);
--> statement-breakpoint
CREATE INDEX `momentum_critical_alert_lookup_idx` ON `momentum_critical_alerts` (`userId`,`status`,`createdAt`);