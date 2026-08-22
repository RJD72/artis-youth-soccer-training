CREATE TABLE `waitlist_entries` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`training_group_id` int unsigned NOT NULL,
	`child_first_name` varchar(50) NOT NULL,
	`child_last_name` varchar(50) NOT NULL,
	`guardian_full_name` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`notes` text,
	`status` enum('waiting','contacted','converted','cancelled') NOT NULL DEFAULT 'waiting',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `waitlist_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `waitlist_entries` ADD CONSTRAINT `waitlist_entries_training_group_id_training_groups_id_fk` FOREIGN KEY (`training_group_id`) REFERENCES `training_groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `waitlist_entries_group_status_created_index` ON `waitlist_entries` (`training_group_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `waitlist_entries_email_index` ON `waitlist_entries` (`email`);