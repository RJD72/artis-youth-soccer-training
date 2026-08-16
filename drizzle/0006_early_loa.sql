CREATE TABLE `payments` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`registration_id` int unsigned NOT NULL,
	`status` enum('pending','succeeded','failed','cancelled','partially_refunded','refunded') NOT NULL DEFAULT 'pending',
	`stripe_checkout_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`subtotal_cents` int unsigned NOT NULL,
	`tax_cents` int unsigned NOT NULL DEFAULT 0,
	`total_cents` int unsigned NOT NULL,
	`refunded_cents` int unsigned NOT NULL DEFAULT 0,
	`currency` char(3) NOT NULL DEFAULT 'CAD',
	`paid_at` timestamp,
	`refunded_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripe_checkout_session_id_unique` UNIQUE(`stripe_checkout_session_id`),
	CONSTRAINT `payments_stripe_payment_intent_id_unique` UNIQUE(`stripe_payment_intent_id`)
);
--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_registration_id_registrations_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_registration_id_index` ON `payments` (`registration_id`);--> statement-breakpoint
CREATE INDEX `payments_status_index` ON `payments` (`status`);