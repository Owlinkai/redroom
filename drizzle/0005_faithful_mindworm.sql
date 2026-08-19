CREATE TABLE `facility_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255),
	`nameAlias` varchar(500),
	`type` enum('data_center','oil_gas','nuclear','military','airport','embassy','satellite','company','port','power_plant','refinery','pipeline','dam','hospital','government','financial','telecom','research','other') NOT NULL,
	`country` varchar(100) NOT NULL,
	`region` varchar(100) DEFAULT 'MENA',
	`city` varchar(100),
	`address` varchar(500),
	`latitude` float,
	`longitude` float,
	`description` text,
	`operator` varchar(255),
	`owner` varchar(255),
	`capacity` varchar(100),
	`area` varchar(100),
	`personnel` varchar(100),
	`operationalSince` varchar(50),
	`estimatedValue` varchar(100),
	`status` enum('active','inactive','under_construction','decommissioned','unknown') DEFAULT 'active',
	`threatLevel` enum('low','medium','high','critical') DEFAULT 'low',
	`importance` int DEFAULT 5,
	`tags` json,
	`externalIds` json,
	`sourceUrl` varchar(1000),
	`sourceName` varchar(255),
	`sourceType` enum('government_filing','iaea_report','un_document','satellite_imagery','official_website','regulatory_body','academic_paper','news_report','ngo_report','court_document','manual_entry','other') DEFAULT 'manual_entry',
	`discoveryMethod` enum('llm_search','manual_entry','rss_crawl','import') DEFAULT 'manual_entry',
	`discoveryQuery` varchar(500),
	`rawData` text,
	`confidenceScore` float DEFAULT 0.5,
	`reviewStatus` enum('pending','under_review','approved','rejected','duplicate') DEFAULT 'pending',
	`submittedBy` varchar(255),
	`reviewedBy` varchar(255),
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`approvedFacilityId` int,
	`reenrichmentTriggered` boolean DEFAULT false,
	`reenrichmentJobId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facility_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facility_enrichment_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`facilityName` varchar(255) NOT NULL,
	`status` enum('pending','running','completed','failed') DEFAULT 'pending',
	`articlesScanned` int DEFAULT 0,
	`linksCreated` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`triggeredBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facility_enrichment_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facility_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`facilityId` int NOT NULL,
	`sourceUrl` varchar(1000) NOT NULL,
	`sourceName` varchar(255) NOT NULL,
	`sourceType` enum('government_filing','iaea_report','un_document','satellite_imagery','official_website','regulatory_body','academic_paper','news_report','ngo_report','court_document','manual_entry','other') DEFAULT 'other',
	`confirmsFields` varchar(500),
	`accessedAt` timestamp DEFAULT (now()),
	`publicationDate` varchar(50),
	`authorOrg` varchar(255),
	`reliability` int DEFAULT 70,
	`notes` text,
	`addedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `facility_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `facilities` MODIFY COLUMN `status` enum('active','inactive','under_construction','decommissioned','unknown') DEFAULT 'active';--> statement-breakpoint
ALTER TABLE `facilities` ADD `nameAlias` varchar(500);--> statement-breakpoint
ALTER TABLE `facilities` ADD `address` varchar(500);--> statement-breakpoint
ALTER TABLE `facilities` ADD `owner` varchar(255);--> statement-breakpoint
ALTER TABLE `facilities` ADD `area` varchar(100);--> statement-breakpoint
ALTER TABLE `facilities` ADD `personnel` varchar(100);--> statement-breakpoint
ALTER TABLE `facilities` ADD `operationalSince` varchar(50);--> statement-breakpoint
ALTER TABLE `facilities` ADD `estimatedValue` varchar(100);--> statement-breakpoint
ALTER TABLE `facilities` ADD `externalIds` json;--> statement-breakpoint
ALTER TABLE `facilities` ADD `primarySourceUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `facilities` ADD `primarySourceName` varchar(255);--> statement-breakpoint
ALTER TABLE `facilities` ADD `primarySourceType` enum('government_filing','iaea_report','un_document','satellite_imagery','official_website','regulatory_body','academic_paper','news_report','ngo_report','court_document','manual_entry','other') DEFAULT 'manual_entry';--> statement-breakpoint
ALTER TABLE `facilities` ADD `verificationStatus` enum('unverified','pending_review','verified','disputed','classified') DEFAULT 'unverified';--> statement-breakpoint
ALTER TABLE `facilities` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `facilities` ADD `verifiedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `facilities` ADD `verificationNotes` text;--> statement-breakpoint
ALTER TABLE `facilities` ADD `approvalStatus` enum('draft','pending_approval','approved','rejected') DEFAULT 'approved';--> statement-breakpoint
ALTER TABLE `facilities` ADD `submittedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `facilities` ADD `approvedBy` varchar(255);--> statement-breakpoint
ALTER TABLE `facilities` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `facilities` ADD `rejectionReason` text;--> statement-breakpoint
ALTER TABLE `facilities` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `facilities` ADD `auditLog` text;--> statement-breakpoint
CREATE INDEX `idx_cand_review` ON `facility_candidates` (`reviewStatus`);--> statement-breakpoint
CREATE INDEX `idx_cand_country` ON `facility_candidates` (`country`);--> statement-breakpoint
CREATE INDEX `idx_cand_type` ON `facility_candidates` (`type`);--> statement-breakpoint
CREATE INDEX `idx_cand_method` ON `facility_candidates` (`discoveryMethod`);--> statement-breakpoint
CREATE INDEX `idx_enrich_facility` ON `facility_enrichment_jobs` (`facilityId`);--> statement-breakpoint
CREATE INDEX `idx_enrich_status` ON `facility_enrichment_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fac_src_facility` ON `facility_sources` (`facilityId`);--> statement-breakpoint
CREATE INDEX `idx_fac_src_type` ON `facility_sources` (`sourceType`);--> statement-breakpoint
CREATE INDEX `idx_fac_approval` ON `facilities` (`approvalStatus`);--> statement-breakpoint
CREATE INDEX `idx_fac_verification` ON `facilities` (`verificationStatus`);