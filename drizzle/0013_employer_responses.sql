CREATE TABLE `employer_responses` (
  `id` int AUTO_INCREMENT NOT NULL,
  `application_id` int NOT NULL,
  `user_id` int NOT NULL,
  `response_type` enum('viewed','rejection','interview_invite','offer','employer_question','other') NOT NULL,
  `source` enum('email','employer_portal','linkedin','phone','other') NOT NULL,
  `summary` text NOT NULL,
  `received_at` timestamp NOT NULL,
  `status_before` enum('pending','applied','viewed','interview','offer','rejected','accepted','withdrawn') NOT NULL,
  `status_after` enum('pending','applied','viewed','interview','offer','rejected','accepted','withdrawn') NOT NULL,
  `note_id` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `employer_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `employer_responses_application_idx` ON `employer_responses` (`application_id`);
--> statement-breakpoint
CREATE INDEX `employer_responses_user_received_idx` ON `employer_responses` (`user_id`,`received_at`);
