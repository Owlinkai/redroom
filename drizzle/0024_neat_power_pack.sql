CREATE TABLE `narrative_investigations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`narrativeId` int NOT NULL,
	`hypothesis` text NOT NULL,
	`verdict` enum('SUPPORTED','REFUTED','INCONCLUSIVE') NOT NULL,
	`confidence` float NOT NULL,
	`reasoning` text,
	`supportingEvidence` json,
	`counterEvidence` json,
	`attributes` json,
	`analystId` varchar(255),
	`analystName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `narrative_investigations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_narr_inv_narrative` ON `narrative_investigations` (`narrativeId`);--> statement-breakpoint
CREATE INDEX `idx_narr_inv_created` ON `narrative_investigations` (`createdAt`);