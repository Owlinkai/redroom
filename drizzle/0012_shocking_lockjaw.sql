CREATE TABLE `country_intel_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`country` varchar(100) NOT NULL,
	`isoA3` varchar(3),
	`region` varchar(100),
	`capital` varchar(100),
	`governmentType` varchar(200),
	`headOfState` varchar(200),
	`population` bigint,
	`gdpUsd` bigint,
	`gdpPerCapita` int,
	`militaryBudgetUsd` bigint,
	`armedForcesSize` int,
	`threatLevel` enum('LOW','MODERATE','HIGH','CRITICAL','EXTREME') DEFAULT 'MODERATE',
	`nuclearStatus` enum('none','civilian','suspected','confirmed','treaty') DEFAULT 'none',
	`sanctionsStatus` text,
	`unMemberStatus` varchar(100) DEFAULT 'Member',
	`keyLeaders` json,
	`alliances` json,
	`activeConflicts` json,
	`humanRightsIndex` float,
	`pressFreedomIndex` int,
	`corruptionIndex` int,
	`internetFreedom` enum('free','partly_free','not_free'),
	`keyIntelNotes` text,
	`sources` json,
	`lastUpdated` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `country_intel_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `country_intel_data_country_unique` UNIQUE(`country`)
);
--> statement-breakpoint
CREATE INDEX `idx_country_intel_country` ON `country_intel_data` (`country`);--> statement-breakpoint
CREATE INDEX `idx_country_intel_region` ON `country_intel_data` (`region`);--> statement-breakpoint
CREATE INDEX `idx_country_intel_threat` ON `country_intel_data` (`threatLevel`);