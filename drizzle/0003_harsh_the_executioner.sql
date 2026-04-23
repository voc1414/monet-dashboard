CREATE TABLE `staff_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffName` varchar(100) NOT NULL,
	`storeName` varchar(100) NOT NULL,
	`previousStatus` enum('active','retired') NOT NULL,
	`newStatus` enum('active','retired') NOT NULL,
	`changeMonth` varchar(7),
	`changedBy` varchar(100) NOT NULL DEFAULT 'admin',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staff_status_history_id` PRIMARY KEY(`id`)
);
