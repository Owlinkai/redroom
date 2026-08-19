CREATE TABLE `key_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyValue` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`createdBy` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`registrationCount` int NOT NULL DEFAULT 0,
	`label` varchar(255),
	CONSTRAINT `key_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llm_quotas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dailyLimit` int NOT NULL DEFAULT 50,
	`monthlyLimit` int NOT NULL DEFAULT 1000,
	`usedToday` int NOT NULL DEFAULT 0,
	`usedThisMonth` int NOT NULL DEFAULT 0,
	`lastDailyReset` timestamp NOT NULL DEFAULT (now()),
	`lastMonthlyReset` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llm_quotas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `super_admin_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(100) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastLoginAt` timestamp,
	`failedAttempts` int NOT NULL DEFAULT 0,
	`lockedUntil` timestamp,
	CONSTRAINT `super_admin_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `super_admin_credentials_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionDurationMinutes` int NOT NULL DEFAULT 180,
	`lastActivity` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `admin_registration_requests` ADD `usedKey` varchar(255);--> statement-breakpoint
CREATE INDEX `idx_key_history_active` ON `key_history` (`isActive`);--> statement-breakpoint
CREATE INDEX `llm_quotas_userId_idx` ON `llm_quotas` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_userId` ON `user_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_active` ON `user_sessions` (`isActive`);