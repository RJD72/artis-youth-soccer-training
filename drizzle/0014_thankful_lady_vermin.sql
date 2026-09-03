CREATE TABLE `guardian_verification_tokens` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`guardian_id` int unsigned NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`consumed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `guardian_verification_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `guardian_verification_tokens_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `guardian_verification_tokens` ADD CONSTRAINT `guardian_verification_tokens_guardian_id_guardians_id_fk` FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `guardian_verification_tokens_guardian_expiry_index` ON `guardian_verification_tokens` (`guardian_id`,`expires_at`);