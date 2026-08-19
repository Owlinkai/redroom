CREATE TABLE `investigations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`note` text,
	`query` varchar(500),
	`region` varchar(100) DEFAULT 'MENA',
	`graphFilter` json,
	`nodeCount` int DEFAULT 0,
	`edgeCount` int DEFAULT 0,
	`topEntities` json,
	`topTopics` json,
	`topCountries` json,
	`snapshotJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `investigations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD `entitiesJson` text;--> statement-breakpoint
CREATE INDEX `idx_inv_created` ON `investigations` (`createdAt`);--> statement-breakpoint
ALTER TABLE `articles` DROP COLUMN `entities`;