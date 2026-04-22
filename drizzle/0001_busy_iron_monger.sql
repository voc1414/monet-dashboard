CREATE TABLE `staff_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffName` varchar(100) NOT NULL,
	`storeName` varchar(100) NOT NULL,
	`status` enum('active','retired') NOT NULL DEFAULT 'active',
	`retiredMonth` varchar(7),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `updatedAt` timestamp NOT NULL DEFAULT (now());