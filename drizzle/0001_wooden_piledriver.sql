CREATE TABLE `weekly_sessions` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`training_group_id` int unsigned NOT NULL,
	`day_of_week` enum('monday','tuesday','wednesday','thursday','friday','saturday','sunday') NOT NULL,
	`session_type` enum('training','game_training') NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_sessions_group_day_start_unique` UNIQUE(`training_group_id`,`day_of_week`,`start_time`)
);
--> statement-breakpoint
ALTER TABLE `weekly_sessions` ADD CONSTRAINT `weekly_sessions_training_group_id_training_groups_id_fk` FOREIGN KEY (`training_group_id`) REFERENCES `training_groups`(`id`) ON DELETE restrict ON UPDATE no action;