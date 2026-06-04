CREATE TABLE `stylist_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`canonicalName` varchar(100) NOT NULL,
	`alias` varchar(200) NOT NULL,
	`storeName` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stylist_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `alias_store_idx` UNIQUE(`alias`,`storeName`)
);
