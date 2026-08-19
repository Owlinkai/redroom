CREATE TABLE `admin_registration_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`passwordHash` varchar(255) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`ipAddress` varchar(45),
	`userAgent` text,
	`notes` text,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`reviewedBy` int,
	CONSTRAINT `admin_registration_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_admin_req_status` ON `admin_registration_requests` (`status`);--> statement-breakpoint
CREATE INDEX `idx_admin_req_email` ON `admin_registration_requests` (`email`);