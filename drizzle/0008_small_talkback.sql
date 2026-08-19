CREATE TABLE `crawl_missions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`codename` varchar(100),
	`description` text,
	`targetAgencyIds` json DEFAULT ('[]'),
	`targetCountries` json DEFAULT ('[]'),
	`targetRegions` json DEFAULT ('[]'),
	`targetTypes` json DEFAULT ('[]'),
	`targetTopics` json DEFAULT ('[]'),
	`cronExpression` varchar(100) NOT NULL,
	`intervalMinutes` int,
	`isRecurring` boolean DEFAULT true,
	`priority` enum('low','normal','high','critical') DEFAULT 'normal',
	`classification` enum('UNCLASSIFIED','CONFIDENTIAL','SECRET','TOP SECRET') DEFAULT 'UNCLASSIFIED',
	`isActive` boolean DEFAULT true,
	`isRunning` boolean DEFAULT false,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastRunJobIds` json DEFAULT ('[]'),
	`totalRuns` int DEFAULT 0,
	`totalArticlesCollected` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crawl_missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mission_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`missionId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`status` enum('running','completed','failed','partial') DEFAULT 'running',
	`agenciesCrawled` int DEFAULT 0,
	`articlesFound` int DEFAULT 0,
	`articlesNew` int DEFAULT 0,
	`errorMessage` text,
	`jobIds` json DEFAULT ('[]'),
	CONSTRAINT `mission_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_mission_active` ON `crawl_missions` (`isActive`);--> statement-breakpoint
CREATE INDEX `idx_mission_priority` ON `crawl_missions` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_run_mission` ON `mission_runs` (`missionId`);--> statement-breakpoint
CREATE INDEX `idx_run_started` ON `mission_runs` (`startedAt`);