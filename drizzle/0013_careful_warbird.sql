CREATE TABLE `renewal_verification_tokens` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`player_id` int unsigned NOT NULL,
	`token_hash` char(64) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`consumed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `renewal_verification_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `renewal_verification_tokens_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
ALTER TABLE `renewal_verification_tokens` ADD CONSTRAINT `renewal_verification_tokens_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `renewal_verification_tokens_player_expiry_index` ON `renewal_verification_tokens` (`player_id`,`expires_at`);