CREATE TABLE `article_facility_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int NOT NULL,
	`facilityId` int NOT NULL,
	`mentionType` enum('attack','threat','inspection','construction','closure','general') DEFAULT 'general',
	`confidence` float DEFAULT 0.8,
	`excerpt` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_facility_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`titleAr` varchar(500),
	`content` text,
	`summary` text,
	`url` varchar(1000) NOT NULL,
	`imageUrl` varchar(1000),
	`agencyId` int NOT NULL,
	`author` varchar(255),
	`publishedAt` timestamp NOT NULL,
	`crawledAt` timestamp DEFAULT (now()),
	`language` varchar(10) DEFAULT 'en',
	`country` varchar(100),
	`region` varchar(100) DEFAULT 'MENA',
	`categories` json DEFAULT ('[]'),
	`topics` json DEFAULT ('[]'),
	`sentiment` enum('positive','neutral','negative','mixed') DEFAULT 'neutral',
	`sentimentScore` float DEFAULT 0,
	`importance` int DEFAULT 5,
	`isBreaking` boolean DEFAULT false,
	`isTrending` boolean DEFAULT false,
	`viewCount` int DEFAULT 0,
	`shareCount` int DEFAULT 0,
	`replicatedFrom` int,
	`replicationCount` int DEFAULT 0,
	`keywords` json DEFAULT ('[]'),
	`entities` json DEFAULT ('{"persons":[],"organizations":[],"locations":[],"facilities":[],"events":[]}'),
	`storageKey` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `articles_url_unique` UNIQUE(`url`)
);
--> statement-breakpoint
CREATE TABLE `crawl_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agencyId` int NOT NULL,
	`status` enum('pending','running','completed','failed') DEFAULT 'pending',
	`startedAt` timestamp,
	`completedAt` timestamp,
	`articlesFound` int DEFAULT 0,
	`articlesNew` int DEFAULT 0,
	`errorMessage` text,
	`region` varchar(100) DEFAULT 'MENA',
	`topics` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `crawl_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255),
	`type` enum('data_center','oil_gas','nuclear','military','airport','embassy','satellite','company','port','power_plant','refinery','pipeline','dam','hospital','government','financial','telecom','research','other') NOT NULL,
	`country` varchar(100) NOT NULL,
	`region` varchar(100) DEFAULT 'MENA',
	`city` varchar(100),
	`latitude` float NOT NULL,
	`longitude` float NOT NULL,
	`description` text,
	`operator` varchar(255),
	`capacity` varchar(100),
	`status` enum('active','inactive','under_construction','decommissioned') DEFAULT 'active',
	`threatLevel` enum('low','medium','high','critical') DEFAULT 'low',
	`importance` int DEFAULT 5,
	`tags` json DEFAULT ('[]'),
	`metadata` json DEFAULT ('{}'),
	`lastIncident` timestamp,
	`newsCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `news_agencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255),
	`country` varchar(100) NOT NULL,
	`region` varchar(100) NOT NULL DEFAULT 'MENA',
	`website` varchar(500),
	`rssFeeds` json DEFAULT ('[]'),
	`apiEndpoint` varchar(500),
	`language` varchar(50) DEFAULT 'en',
	`languages` json DEFAULT ('["en"]'),
	`type` enum('state','independent','international','digital','broadcast','wire') DEFAULT 'independent',
	`bias` enum('left','center-left','center','center-right','right','state') DEFAULT 'center',
	`reliability` int DEFAULT 70,
	`monthlyVisitors` bigint,
	`founded` int,
	`logoUrl` varchar(500),
	`description` text,
	`categories` json DEFAULT ('[]'),
	`isActive` boolean DEFAULT true,
	`lastCrawled` timestamp,
	`crawlFrequency` int DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `news_agencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`articleId` int,
	`facilityId` int,
	`type` enum('breaking','facility_attack','critical_event','trending','system') NOT NULL,
	`title` varchar(500) NOT NULL,
	`message` text,
	`severity` enum('info','warning','critical') DEFAULT 'info',
	`region` varchar(100) DEFAULT 'MENA',
	`isRead` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(128),
	`name` varchar(255) NOT NULL,
	`regions` json DEFAULT ('["MENA"]'),
	`topics` json DEFAULT ('[]'),
	`facilityTypes` json DEFAULT ('[]'),
	`keywords` json DEFAULT ('[]'),
	`isActive` boolean DEFAULT true,
	`notifyOnCritical` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_article_link` ON `article_facility_links` (`articleId`);--> statement-breakpoint
CREATE INDEX `idx_facility_link` ON `article_facility_links` (`facilityId`);--> statement-breakpoint
CREATE INDEX `idx_agency` ON `articles` (`agencyId`);--> statement-breakpoint
CREATE INDEX `idx_published` ON `articles` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `idx_region_art` ON `articles` (`region`);--> statement-breakpoint
CREATE INDEX `idx_breaking` ON `articles` (`isBreaking`);--> statement-breakpoint
CREATE INDEX `idx_agency_job` ON `crawl_jobs` (`agencyId`);--> statement-breakpoint
CREATE INDEX `idx_status_job` ON `crawl_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_type` ON `facilities` (`type`);--> statement-breakpoint
CREATE INDEX `idx_country_fac` ON `facilities` (`country`);--> statement-breakpoint
CREATE INDEX `idx_region_fac` ON `facilities` (`region`);--> statement-breakpoint
CREATE INDEX `idx_region` ON `news_agencies` (`region`);--> statement-breakpoint
CREATE INDEX `idx_country` ON `news_agencies` (`country`);--> statement-breakpoint
CREATE INDEX `idx_notif_type` ON `notifications` (`type`);--> statement-breakpoint
CREATE INDEX `idx_notif_read` ON `notifications` (`isRead`);