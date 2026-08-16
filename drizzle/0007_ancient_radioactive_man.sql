CREATE TABLE `legal_acceptances` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`registration_id` int unsigned NOT NULL,
	`guardian_id` int unsigned NOT NULL,
	`legal_document_id` int unsigned NOT NULL,
	`accepted_by_name` varchar(100) NOT NULL,
	`accepted_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_acceptances_id` PRIMARY KEY(`id`),
	CONSTRAINT `legal_acceptances_registration_document_unique` UNIQUE(`registration_id`,`legal_document_id`)
);
--> statement-breakpoint
CREATE TABLE `legal_documents` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`document_type` enum('participation_waiver','privacy_policy','cancellation_refund_policy') NOT NULL,
	`version` varchar(50) NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`content_hash` char(64) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT false,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `legal_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `legal_documents_type_version_unique` UNIQUE(`document_type`,`version`)
);
--> statement-breakpoint
ALTER TABLE `legal_acceptances` ADD CONSTRAINT `legal_acceptances_registration_id_registrations_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_acceptances` ADD CONSTRAINT `legal_acceptances_guardian_id_guardians_id_fk` FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_acceptances` ADD CONSTRAINT `legal_acceptances_legal_document_id_legal_documents_id_fk` FOREIGN KEY (`legal_document_id`) REFERENCES `legal_documents`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `legal_acceptances_guardian_id_index` ON `legal_acceptances` (`guardian_id`);--> statement-breakpoint
CREATE INDEX `legal_acceptances_document_id_index` ON `legal_acceptances` (`legal_document_id`);--> statement-breakpoint
CREATE INDEX `legal_documents_active_index` ON `legal_documents` (`document_type`,`is_active`);