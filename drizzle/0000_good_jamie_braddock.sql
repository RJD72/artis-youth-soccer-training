CREATE TABLE `training_groups` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(50) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`minimum_age` int unsigned NOT NULL,
	`maximum_age` int unsigned NOT NULL,
	`capacity` int unsigned NOT NULL DEFAULT 30,
	`registration_open` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `training_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `training_groups_slug_unique` UNIQUE(`slug`)
);
