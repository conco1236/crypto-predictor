ALTER TABLE `technical_ai_settings` ADD `quotaAlertEnabled` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaAlertThresholdPercent` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaAlertState` enum('normal','low','unavailable') DEFAULT 'unavailable' NOT NULL;--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaAlertKind` varchar(30);--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaAlertDeliveryStatus` enum('pending','sent','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaCheckLastAt` timestamp;--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaAlertLastAt` timestamp;--> statement-breakpoint
ALTER TABLE `technical_ai_settings` ADD `quotaAlertLastPercent` int;