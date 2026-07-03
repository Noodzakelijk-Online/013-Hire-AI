CREATE TABLE `application_decisions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `job_id` int NOT NULL,
  `decision` enum('apply','save','ignore','review','manual_apply') NOT NULL,
  `decision_reason` text,
  `match_score` int,
  `risk_level` enum('low','medium','high') NOT NULL DEFAULT 'medium',
  `review_required` int NOT NULL DEFAULT 1,
  `review_reason` text,
  `decided_by` enum('system','user','admin') NOT NULL DEFAULT 'system',
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `application_decisions_id` PRIMARY KEY(`id`),
  CONSTRAINT `application_decisions_user_job_unique` UNIQUE(`user_id`,`job_id`)
);
--> statement-breakpoint
CREATE INDEX `application_decisions_user_decision_idx` ON `application_decisions` (`user_id`,`decision`);
--> statement-breakpoint
CREATE INDEX `application_decisions_review_required_idx` ON `application_decisions` (`review_required`);
