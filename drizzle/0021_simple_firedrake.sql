CREATE TABLE `countries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`iso2` varchar(2) NOT NULL,
	`iso3` varchar(3) NOT NULL,
	`region` varchar(100) NOT NULL,
	`subRegion` varchar(100),
	`capital` varchar(150),
	`lat` float,
	`lon` float,
	`flagEmoji` varchar(10),
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `countries_id` PRIMARY KEY(`id`),
	CONSTRAINT `countries_iso2_unique` UNIQUE(`iso2`),
	CONSTRAINT `countries_iso3_unique` UNIQUE(`iso3`)
);
--> statement-breakpoint
CREATE TABLE `google_news_topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`region` varchar(100) NOT NULL,
	`label` varchar(150) NOT NULL,
	`query` varchar(300) NOT NULL,
	`category` varchar(100),
	`sortOrder` int DEFAULT 99,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `google_news_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `narratives` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`region` varchar(100) NOT NULL,
	`category` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`threatLevel` varchar(20) NOT NULL DEFAULT 'medium',
	`originCountry` varchar(150),
	`targetCountries` json DEFAULT ('[]'),
	`linkedFacilityIds` json DEFAULT ('[]'),
	`linkedAgencyIds` json DEFAULT ('[]'),
	`knownAuthors` json DEFAULT ('[]'),
	`knownPublishers` json DEFAULT ('[]'),
	`firstDetected` timestamp NOT NULL,
	`lastSeen` timestamp NOT NULL,
	`articleCount` int DEFAULT 0,
	`confidence` float DEFAULT 0.5,
	`tags` json DEFAULT ('[]'),
	`analystNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `narratives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `population_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country` varchar(150) NOT NULL,
	`iso3` varchar(3),
	`region` varchar(100) NOT NULL,
	`population` bigint NOT NULL,
	`displaced` bigint DEFAULT 0,
	`refugees` bigint DEFAULT 0,
	`idps` bigint DEFAULT 0,
	`urbanPct` float,
	`gdpPerCapita` float,
	`hdi` float,
	`conflictLevel` varchar(20) DEFAULT 'low',
	`dataYear` int DEFAULT 2024,
	`sources` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `population_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `region_hotspots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`region` varchar(100) NOT NULL,
	`name` varchar(200),
	`lat` float NOT NULL,
	`lon` float NOT NULL,
	`intensity` float DEFAULT 0.8,
	`threatLevel` varchar(20) DEFAULT 'HIGH',
	`description` text,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `region_hotspots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`label` varchar(100) NOT NULL,
	`shortLabel` varchar(50),
	`description` text,
	`centerLat` float NOT NULL,
	`centerLon` float NOT NULL,
	`defaultZoom` int DEFAULT 4,
	`glCode` varchar(10),
	`hlCode` varchar(10),
	`ceid` varchar(20),
	`threatLevel` varchar(20) DEFAULT 'MODERATE',
	`color` varchar(20),
	`sortOrder` int DEFAULT 99,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regions_id` PRIMARY KEY(`id`),
	CONSTRAINT `regions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `threat_levels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`label` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(20) NOT NULL,
	`hexInt` varchar(20),
	`bgClass` varchar(50),
	`textClass` varchar(50),
	`borderClass` varchar(50),
	`sortOrder` int DEFAULT 99,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `threat_levels_id` PRIMARY KEY(`id`),
	CONSTRAINT `threat_levels_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`label` varchar(100) NOT NULL,
	`description` text,
	`color` varchar(20),
	`icon` varchar(50),
	`sortOrder` int DEFAULT 99,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `topics_id` PRIMARY KEY(`id`),
	CONSTRAINT `topics_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `un_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(500) NOT NULL,
	`category` varchar(100),
	`type` varchar(100),
	`region` varchar(100) DEFAULT 'Global',
	`dataTypes` json,
	`updateFreq` varchar(50),
	`verified` boolean DEFAULT true,
	`apiAvailable` boolean DEFAULT false,
	`apiUrl` varchar(500),
	`description` text,
	`sortOrder` int DEFAULT 99,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `un_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_countries_region` ON `countries` (`region`);--> statement-breakpoint
CREATE INDEX `idx_countries_iso2` ON `countries` (`iso2`);--> statement-breakpoint
CREATE INDEX `idx_gnt_region` ON `google_news_topics` (`region`);--> statement-breakpoint
CREATE INDEX `idx_narratives_region` ON `narratives` (`region`);--> statement-breakpoint
CREATE INDEX `idx_narratives_status` ON `narratives` (`status`);--> statement-breakpoint
CREATE INDEX `idx_narratives_category` ON `narratives` (`category`);--> statement-breakpoint
CREATE INDEX `idx_popdata_region` ON `population_data` (`region`);--> statement-breakpoint
CREATE INDEX `idx_popdata_country` ON `population_data` (`country`);--> statement-breakpoint
CREATE INDEX `idx_hotspots_region` ON `region_hotspots` (`region`);--> statement-breakpoint
CREATE INDEX `idx_unsources_region` ON `un_sources` (`region`);--> statement-breakpoint
CREATE INDEX `idx_unsources_category` ON `un_sources` (`category`);