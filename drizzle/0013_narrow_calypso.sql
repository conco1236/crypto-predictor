CREATE TABLE `telegram_quality_threshold_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exchange` varchar(20),
	`previousThreshold` int,
	`nextThreshold` int NOT NULL,
	`source` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `telegram_quality_threshold_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_quality_threshold_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exchange` varchar(20) NOT NULL,
	`threshold` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_quality_threshold_overrides_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_quality_threshold_user_exchange_unique` UNIQUE(`userId`,`exchange`)
);
--> statement-breakpoint
CREATE INDEX `telegram_quality_threshold_history_user_idx` ON `telegram_quality_threshold_history` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `telegram_quality_threshold_user_idx` ON `telegram_quality_threshold_overrides` (`userId`,`updatedAt`);