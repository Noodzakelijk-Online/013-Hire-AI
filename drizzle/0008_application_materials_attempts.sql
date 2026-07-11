CREATE TABLE `application_materials` (
  `id` int AUTO_INCREMENT NOT NULL,
  `application_id` int NOT NULL,
  `resume_id` int,
  `custom_resume` text,
  `cover_letter` text,
  `custom_answers` text,
  `claims_made` text,
  `source_profile_snapshot` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `application_materials_id` PRIMARY KEY(`id`),
  CONSTRAINT `application_materials_application_unique` UNIQUE(`application_id`)
);
--> statement-breakpoint
CREATE TABLE `application_attempts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `application_id` int NOT NULL,
  `user_id` int NOT NULL,
  `job_id` int NOT NULL,
  `platform_id` int,
  `attempt_type` enum('prepare','manual_confirmation','external_handoff') NOT NULL DEFAULT 'prepare',
  `status` enum('prepared','review_required','submitted','failed','cancelled') NOT NULL DEFAULT 'prepared',
  `started_at` timestamp NOT NULL DEFAULT (now()),
  `finished_at` timestamp,
  `error_message` text,
  `confirmation_text` text,
  `confirmation_url` varchar(1000),
  `screenshot_key` varchar(500),
  `retry_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `application_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `application_attempts_application_idx` ON `application_attempts` (`application_id`);
--> statement-breakpoint
CREATE INDEX `application_attempts_user_status_idx` ON `application_attempts` (`user_id`,`status`);
