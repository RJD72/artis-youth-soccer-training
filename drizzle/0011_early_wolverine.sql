ALTER TABLE `legal_documents` MODIFY COLUMN `document_type` enum('terms_conditions','participation_waiver','gym_facility_rules','privacy_policy','cancellation_refund_policy') NOT NULL;--> statement-breakpoint
ALTER TABLE `guardians` ADD `secondary_phone` varchar(30);--> statement-breakpoint
ALTER TABLE `guardians` ADD `preferred_contact_method` enum('email','phone','text') DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `payment_method` enum('stripe','e_transfer') DEFAULT 'stripe' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `manual_payment_reference` varchar(50);--> statement-breakpoint
ALTER TABLE `players` ADD `preferred_name` varchar(50);--> statement-breakpoint
ALTER TABLE `players` ADD `current_playing_level` varchar(100);--> statement-breakpoint
ALTER TABLE `players` ADD `current_team_or_club` varchar(100);--> statement-breakpoint
ALTER TABLE `players` ADD `coach_information_encrypted` text;--> statement-breakpoint
ALTER TABLE `registrations` ADD `guardian_relationship` varchar(50);--> statement-breakpoint
ALTER TABLE `registrations` ADD `authorized_registrant_confirmed_at` timestamp;--> statement-breakpoint
ALTER TABLE `registrations` ADD `information_accuracy_confirmed_at` timestamp;--> statement-breakpoint
ALTER TABLE `registrations` ADD `marketing_consent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `registrations` ADD `photo_video_consent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_manual_payment_reference_unique` UNIQUE(`manual_payment_reference`);