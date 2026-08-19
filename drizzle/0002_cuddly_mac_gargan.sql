ALTER TABLE `articles` MODIFY COLUMN `categories` json;--> statement-breakpoint
ALTER TABLE `articles` MODIFY COLUMN `topics` json;--> statement-breakpoint
ALTER TABLE `articles` MODIFY COLUMN `keywords` json;--> statement-breakpoint
ALTER TABLE `articles` MODIFY COLUMN `entities` json;--> statement-breakpoint
ALTER TABLE `crawl_jobs` MODIFY COLUMN `topics` json;--> statement-breakpoint
ALTER TABLE `facilities` MODIFY COLUMN `tags` json;--> statement-breakpoint
ALTER TABLE `facilities` MODIFY COLUMN `metadata` json;--> statement-breakpoint
ALTER TABLE `news_agencies` MODIFY COLUMN `rssFeeds` json;--> statement-breakpoint
ALTER TABLE `news_agencies` MODIFY COLUMN `languages` json;--> statement-breakpoint
ALTER TABLE `news_agencies` MODIFY COLUMN `categories` json;--> statement-breakpoint
ALTER TABLE `watchlists` MODIFY COLUMN `regions` json;--> statement-breakpoint
ALTER TABLE `watchlists` MODIFY COLUMN `topics` json;--> statement-breakpoint
ALTER TABLE `watchlists` MODIFY COLUMN `facilityTypes` json;--> statement-breakpoint
ALTER TABLE `watchlists` MODIFY COLUMN `keywords` json;