CREATE TABLE `surveillance_missions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`codename` varchar(100),
	`description` text,
	`status` enum('planning','active','paused','completed','archived') NOT NULL DEFAULT 'planning',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`classification` enum('unclassified','confidential','secret','top_secret') NOT NULL DEFAULT 'unclassified',
	`aoiLat` float,
	`aoiLon` float,
	`aoiRadiusKm` float,
	`aoiName` varchar(255),
	`assignedSatellites` json DEFAULT ('[]'),
	`startDate` timestamp,
	`endDate` timestamp,
	`objectives` text,
	`notes` text,
	`tags` json,
	`createdBy` int,
	`passCount` int DEFAULT 0,
	`lastPassAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `surveillance_missions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_missions_status` ON `surveillance_missions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_missions_priority` ON `surveillance_missions` (`priority`);--> statement-breakpoint
CREATE INDEX `idx_missions_created_by` ON `surveillance_missions` (`createdBy`);