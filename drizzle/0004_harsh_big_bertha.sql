CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`area` varchar(100) NOT NULL,
	`displayOrder` int NOT NULL DEFAULT 0,
	`rawNameVariants` text,
	`salonBoardSheetName` varchar(200),
	`isActive` int NOT NULL DEFAULT 1,
	`isAutoDetected` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `stores_name_unique` UNIQUE(`name`)
);
