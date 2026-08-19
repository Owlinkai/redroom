CREATE TABLE `sigint_cameras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`name` varchar(500) NOT NULL,
	`latitude` float NOT NULL,
	`longitude` float NOT NULL,
	`country` varchar(100) NOT NULL,
	`countryCode` varchar(10) NOT NULL,
	`city` varchar(255),
	`source` varchar(255) NOT NULL,
	`sourceApi` varchar(1000) NOT NULL,
	`feedUrl` varchar(1000) NOT NULL,
	`feedType` enum('image','video','stream') DEFAULT 'image',
	`direction` varchar(100),
	`road` varchar(255),
	`isActive` boolean DEFAULT true,
	`lastVerified` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sigint_cameras_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_cam_country` ON `sigint_cameras` (`countryCode`);--> statement-breakpoint
CREATE INDEX `idx_cam_source` ON `sigint_cameras` (`source`);--> statement-breakpoint
CREATE INDEX `idx_cam_active` ON `sigint_cameras` (`isActive`);