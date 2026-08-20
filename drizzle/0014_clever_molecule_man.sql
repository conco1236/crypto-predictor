CREATE TABLE `momentum_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`criticalDropThreshold` int NOT NULL DEFAULT 15,
	`deterioratingDropThreshold` int NOT NULL DEFAULT 8,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `momentum_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `momentum_settings_user_unique` UNIQUE(`userId`)
);
