ALTER TABLE `crawl_missions` ADD `createdBy` varchar(100);--> statement-breakpoint
ALTER TABLE `crawl_missions` ADD `createdByCredId` int;--> statement-breakpoint
ALTER TABLE `mission_runs` ADD `triggeredBy` enum('scheduled','manual') DEFAULT 'scheduled';--> statement-breakpoint
ALTER TABLE `mission_runs` ADD `triggeredByUser` varchar(100);