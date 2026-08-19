CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userEmail` varchar(320),
	`userRole` varchar(20),
	`action` varchar(100) NOT NULL,
	`target` varchar(255),
	`details` text,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`description` varchar(500),
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `platform_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE INDEX `idx_activity_user` ON `activity_log` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_activity_action` ON `activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_activity_created` ON `activity_log` (`createdAt`);