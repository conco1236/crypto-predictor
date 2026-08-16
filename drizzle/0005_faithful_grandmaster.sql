CREATE TABLE `telegram_alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL DEFAULT '*',
	`exchange` varchar(20) NOT NULL DEFAULT '*',
	`interval` varchar(10) NOT NULL DEFAULT '*',
	`alertThreshold` int NOT NULL DEFAULT 50,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_alert_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `telegram_alert_rules_scope_unique` UNIQUE(`userId`,`symbol`,`exchange`,`interval`)
);
--> statement-breakpoint
ALTER TABLE `telegram_delivery_logs` ADD `message` text;--> statement-breakpoint
CREATE INDEX `telegram_alert_rules_user_idx` ON `telegram_alert_rules` (`userId`,`updatedAt`);