CREATE TABLE `application_notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `application_id` int NOT NULL,
  `employer_response_id` int NOT NULL,
  `notification_type` enum('interview_invite') NOT NULL,
  `read_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `application_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_notifications_employer_response_unique` ON `application_notifications` (`employer_response_id`);
--> statement-breakpoint
CREATE INDEX `application_notifications_user_read_created_idx` ON `application_notifications` (`user_id`,`read_at`,`created_at`);
--> statement-breakpoint
CREATE INDEX `application_notifications_application_idx` ON `application_notifications` (`application_id`);
