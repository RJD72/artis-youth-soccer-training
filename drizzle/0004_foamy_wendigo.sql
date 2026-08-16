CREATE TABLE `registrations` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`player_id` int unsigned NOT NULL,
	`training_group_id` int unsigned NOT NULL,
	`program_package_id` int unsigned NOT NULL,
	`status` enum('pending_payment','active','waitlisted','expired','cancelled') NOT NULL DEFAULT 'pending_payment',
	`package_price_cents` int unsigned NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'CAD',
	`starts_on` date,
	`ends_on` date,
	`reservation_expires_at` timestamp,
	`waitlisted_at` timestamp,
	`activated_at` timestamp,
	`cancelled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_training_group_id_training_groups_id_fk` FOREIGN KEY (`training_group_id`) REFERENCES `training_groups`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_program_package_id_program_packages_id_fk` FOREIGN KEY (`program_package_id`) REFERENCES `program_packages`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `registrations_player_id_index` ON `registrations` (`player_id`);--> statement-breakpoint
CREATE INDEX `registrations_group_status_end_index` ON `registrations` (`training_group_id`,`status`,`ends_on`);--> statement-breakpoint
CREATE INDEX `registrations_waitlist_order_index` ON `registrations` (`training_group_id`,`status`,`waitlisted_at`);