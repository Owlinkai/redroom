CREATE TABLE `header_prefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`page` varchar(50) NOT NULL,
	`prefs` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` varchar(255),
	CONSTRAINT `header_prefs_id` PRIMARY KEY(`id`),
	CONSTRAINT `header_prefs_page_unique` UNIQUE(`page`)
);
