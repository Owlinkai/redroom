CREATE TABLE `verified_articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`verifiedAt` timestamp NOT NULL DEFAULT (now()),
	`verifiedBy` varchar(255) DEFAULT 'analyst',
	`notes` text,
	`layersData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verified_articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `verified_articles_articleId_unique` UNIQUE(`articleId`)
);
--> statement-breakpoint
CREATE INDEX `idx_verified_article` ON `verified_articles` (`articleId`);--> statement-breakpoint
CREATE INDEX `idx_verified_at` ON `verified_articles` (`verifiedAt`);