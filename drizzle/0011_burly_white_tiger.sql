CREATE TABLE `pipeline_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`stage` varchar(64) NOT NULL,
	`url` varchar(1000) NOT NULL,
	`secret` varchar(500),
	`threshold` int NOT NULL DEFAULT 1,
	`windowSeconds` int NOT NULL DEFAULT 60,
	`payloadTemplate` text,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`lastFiredAt` timestamp,
	`totalFired` int NOT NULL DEFAULT 0,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipeline_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_webhook_stage` ON `pipeline_webhooks` (`stage`);--> statement-breakpoint
CREATE INDEX `idx_webhook_enabled` ON `pipeline_webhooks` (`isEnabled`);