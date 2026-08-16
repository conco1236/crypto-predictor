CREATE TABLE `paper_bot_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(60) NOT NULL,
	`detail` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paper_bot_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paper_trades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exchange` varchar(20) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`direction` enum('Long','Short') NOT NULL,
	`entry` double NOT NULL,
	`takeProfit` double NOT NULL,
	`stopLoss` double NOT NULL,
	`currentPrice` double NOT NULL,
	`status` enum('open','take_profit','stop_loss','cancelled') NOT NULL DEFAULT 'open',
	`openedAt` double NOT NULL,
	`closedAt` double,
	`exitPrice` double,
	`pnlPercent` double NOT NULL DEFAULT 0,
	`sourceSignalKey` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paper_trades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `paper_bot_audit_lookup_idx` ON `paper_bot_audit_logs` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `paper_trades_lookup_idx` ON `paper_trades` (`userId`,`status`,`createdAt`);