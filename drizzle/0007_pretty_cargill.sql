CREATE TABLE `ai_analyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotId` int,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`analysis` text NOT NULL,
	`newsItemIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_analyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news_ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rssSources` text NOT NULL,
	`newsLookbackHours` int NOT NULL DEFAULT 6,
	`aiIntervals` text NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_ai_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `news_ai_settings_user_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `news_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`source` varchar(120) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`publishedAt` double NOT NULL,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `news_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_analyses_lookup_idx` ON `ai_analyses` (`userId`,`symbol`,`interval`,`createdAt`);--> statement-breakpoint
CREATE INDEX `news_items_lookup_idx` ON `news_items` (`userId`,`symbol`,`publishedAt`);