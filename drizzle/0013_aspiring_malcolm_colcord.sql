CREATE TABLE `satellites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`noradId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`intlDesignator` varchar(20),
	`tle1` varchar(100) NOT NULL,
	`tle2` varchar(100) NOT NULL,
	`epoch` timestamp,
	`objectType` enum('PAYLOAD','ROCKET_BODY','DEBRIS','UNKNOWN') DEFAULT 'PAYLOAD',
	`category` varchar(100),
	`country` varchar(100),
	`launchDate` varchar(20),
	`launchSite` varchar(200),
	`missionDescription` text,
	`operator` varchar(200),
	`altitude` float,
	`inclination` float,
	`period` float,
	`apogee` float,
	`perigee` float,
	`eccentricity` float,
	`rcs` varchar(20),
	`decayed` boolean DEFAULT false,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `satellites_id` PRIMARY KEY(`id`),
	CONSTRAINT `satellites_noradId_unique` UNIQUE(`noradId`)
);
--> statement-breakpoint
CREATE INDEX `idx_satellites_norad` ON `satellites` (`noradId`);--> statement-breakpoint
CREATE INDEX `idx_satellites_category` ON `satellites` (`category`);--> statement-breakpoint
CREATE INDEX `idx_satellites_country` ON `satellites` (`country`);