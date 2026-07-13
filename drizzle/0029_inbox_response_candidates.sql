CREATE TABLE `inbox_response_candidates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `application_id` int NOT NULL,
  `provider` enum('gmail','outlook') NOT NULL,
  `message_id` varchar(280) NOT NULL,
  `sender` varchar(500),
  `subject` varchar(500) NOT NULL,
  `preview` text NOT NULL,
  `received_at` timestamp NOT NULL,
  `suggested_response_type` enum('rejection','interview_invite','offer','employer_question','other') NOT NULL,
  `confidence` enum('high','medium') NOT NULL,
  `status` enum('pending','confirmed','dismissed') NOT NULL DEFAULT 'pending',
  `reviewed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `inbox_response_candidates_id` PRIMARY KEY(`id`),
  CONSTRAINT `inbox_response_candidates_user_provider_message_unique` UNIQUE(`user_id`,`provider`,`message_id`)
);
--> statement-breakpoint
CREATE INDEX `inbox_response_candidates_user_status_received_idx` ON `inbox_response_candidates` (`user_id`,`status`,`received_at`);
--> statement-breakpoint
CREATE INDEX `inbox_response_candidates_application_idx` ON `inbox_response_candidates` (`application_id`);
