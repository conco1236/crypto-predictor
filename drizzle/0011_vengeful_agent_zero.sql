ALTER TABLE `telegram_settings` ADD `paperReportEnabled` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `telegram_settings` ADD `paperReportCronTaskUid` varchar(65);--> statement-breakpoint
ALTER TABLE `telegram_settings` ADD `paperReportLastDate` varchar(10);--> statement-breakpoint
CREATE INDEX `telegram_settings_paper_report_task_idx` ON `telegram_settings` (`paperReportCronTaskUid`);