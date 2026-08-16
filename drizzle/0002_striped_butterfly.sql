CREATE TABLE `program_packages` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`slug` varchar(50) NOT NULL,
	`display_name` varchar(100) NOT NULL,
	`duration_months` int unsigned NOT NULL,
	`price_cents` int unsigned NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'CAD',
	`tax_behavior` enum('exclusive','inclusive') NOT NULL DEFAULT 'exclusive',
	`stripe_price_id` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`display_order` int unsigned NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `program_packages_id` PRIMARY KEY(`id`),
	CONSTRAINT `program_packages_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `program_packages_stripe_price_id_unique` UNIQUE(`stripe_price_id`)
);
