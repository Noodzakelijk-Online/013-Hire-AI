CREATE UNIQUE INDEX `success_fees_stripe_subscription_unique` ON `success_fees` (`stripe_subscription_id`);
--> statement-breakpoint
CREATE INDEX `success_fees_user_status_idx` ON `success_fees` (`user_id`,`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `fee_payments_stripe_invoice_unique` ON `fee_payments` (`stripe_invoice_id`);
--> statement-breakpoint
CREATE INDEX `fee_payments_success_fee_status_idx` ON `fee_payments` (`success_fee_id`,`status`);
--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `stripe_event_id` varchar(255) NOT NULL,
  `event_type` varchar(120) NOT NULL,
  `status` enum('processing','processed','failed') NOT NULL DEFAULT 'processing',
  `error_message` text,
  `received_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` timestamp NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `stripe_webhook_events_id` PRIMARY KEY(`id`),
  CONSTRAINT `stripe_webhook_events_event_id_unique` UNIQUE(`stripe_event_id`)
);
--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_status_received_idx` ON `stripe_webhook_events` (`status`,`received_at`);
--> statement-breakpoint
ALTER TABLE `applications` ADD CONSTRAINT `applications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `applications` ADD CONSTRAINT `applications_job_id_jobs_id_fk` FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE `application_attempts` ADD CONSTRAINT `application_attempts_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `employer_responses` ADD CONSTRAINT `employer_responses_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `application_notes` ADD CONSTRAINT `application_notes_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `interview_schedules` ADD CONSTRAINT `interview_schedules_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `user_resumes` ADD CONSTRAINT `user_resumes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `success_fees` ADD CONSTRAINT `success_fees_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE `success_fees` ADD CONSTRAINT `success_fees_application_id_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `employment_verifications` ADD CONSTRAINT `employment_verifications_success_fee_id_success_fees_id_fk` FOREIGN KEY (`success_fee_id`) REFERENCES `success_fees`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE `fee_payments` ADD CONSTRAINT `fee_payments_success_fee_id_success_fees_id_fk` FOREIGN KEY (`success_fee_id`) REFERENCES `success_fees`(`id`) ON DELETE CASCADE;
