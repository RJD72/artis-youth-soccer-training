CREATE TABLE `guardians` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`full_name` varchar(100) NOT NULL,
	`email` varchar(254) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `guardians_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardians_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`guardian_id` int unsigned NOT NULL,
	`full_name` varchar(100) NOT NULL,
	`date_of_birth` date NOT NULL,
	`emergency_contact_name` varchar(100) NOT NULL,
	`emergency_contact_relationship` varchar(50) NOT NULL,
	`emergency_contact_phone` varchar(30) NOT NULL,
	`medical_information_encrypted` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `players_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `players` ADD CONSTRAINT `players_guardian_id_guardians_id_fk` FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `players_guardian_id_index` ON `players` (`guardian_id`);