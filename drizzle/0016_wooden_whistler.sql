CREATE TABLE `technical_ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`mode` enum('workspace_auto','workspace_model','manual_api') NOT NULL DEFAULT 'workspace_auto',
	`model` varchar(160) NOT NULL DEFAULT 'gpt-5-nano',
	`apiBaseUrl` varchar(500),
	`apiKeyCiphertext` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `technical_ai_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `technical_ai_settings_user_unique` UNIQUE(`userId`)
);
