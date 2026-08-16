CREATE TABLE `ai_reanalysis_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotId` int NOT NULL,
	`status` enum('started','completed','failed') NOT NULL,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`error` text,
	CONSTRAINT `ai_reanalysis_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_reanalysis_lookup_idx` ON `ai_reanalysis_requests` (`userId`,`snapshotId`,`requestedAt`);