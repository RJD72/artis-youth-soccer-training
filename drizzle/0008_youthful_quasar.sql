CREATE TABLE `stripe_webhook_events` (
	`id` int unsigned AUTO_INCREMENT NOT NULL,
	`stripe_event_id` varchar(255) NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`stripe_object_id` varchar(255),
	`processing_status` enum('received','processing','processed','failed') NOT NULL DEFAULT 'received',
	`attempt_count` int unsigned NOT NULL DEFAULT 0,
	`last_error` text,
	`livemode` boolean NOT NULL DEFAULT false,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`processed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stripe_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_webhook_events_stripe_event_id_unique` UNIQUE(`stripe_event_id`)
);
--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_status_index` ON `stripe_webhook_events` (`processing_status`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_object_index` ON `stripe_webhook_events` (`event_type`,`stripe_object_id`);