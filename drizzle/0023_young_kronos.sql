CREATE TABLE `upgrade_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portal` varchar(50) NOT NULL,
	`userAgent` text,
	`referrer` varchar(500),
	`clickedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `upgrade_clicks_id` PRIMARY KEY(`id`)
);
