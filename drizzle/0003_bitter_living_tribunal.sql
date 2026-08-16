CREATE TABLE `signal_processing_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`exchange` varchar(20) NOT NULL,
	`symbol` varchar(20) NOT NULL,
	`interval` varchar(10) NOT NULL,
	`candleOpenTime` double NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `signal_processing_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `signal_processing_state_unique` UNIQUE(`userId`,`exchange`,`symbol`,`interval`)
);
