CREATE TABLE `staff_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalName` varchar(255) NOT NULL,
	`store` varchar(255) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`hidden` int NOT NULL DEFAULT 0,
	`retiredMonth` varchar(7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staff_overrides_id` PRIMARY KEY(`id`)
);
