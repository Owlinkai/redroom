CREATE TABLE `site_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(200) NOT NULL,
	`value` text NOT NULL,
	`type` enum('text','url','boolean','json') NOT NULL DEFAULT 'text',
	`section` varchar(100) NOT NULL,
	`label` varchar(255),
	`description` varchar(500),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(100),
	CONSTRAINT `site_content_id` PRIMARY KEY(`id`),
	CONSTRAINT `site_content_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE INDEX `idx_site_content_section` ON `site_content` (`section`);--> statement-breakpoint
CREATE INDEX `idx_site_content_key` ON `site_content` (`key`);