CREATE TABLE `signal_outcomes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`snapshotId` int NOT NULL,
	`exchange` varchar(20) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`outcome` enum('take_profit','stop_loss','expired','invalid') NOT NULL,
	`signalCandleOpenTime` double NOT NULL,
	`exitCandleOpenTime` double,
	`exitPrice` double,
	`returnPercent` double NOT NULL DEFAULT 0,
	`candlesObserved` int NOT NULL DEFAULT 0,
	`reason` text,
	`evaluatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `signal_outcomes_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_outcomes_snapshot_unique` UNIQUE(`userId`,`snapshotId`)
);
--> statement-breakpoint
CREATE INDEX `signal_outcomes_lookup_idx` ON `signal_outcomes` (`userId`,`exchange`,`symbol`,`interval`,`evaluatedAt`);