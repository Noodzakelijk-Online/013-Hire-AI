CREATE TABLE `application_campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `status` enum('active','paused','completed','archived') NOT NULL DEFAULT 'active',
  `title` varchar(255) NOT NULL,
  `target_roles` text,
  `target_locations` text,
  `salary_min` int,
  `salary_max` int,
  `remote_only` int NOT NULL DEFAULT 1,
  `automation_mode` enum('review_first','auto_apply') NOT NULL DEFAULT 'review_first',
  `daily_application_limit` int NOT NULL DEFAULT 12,
  `min_match_score` int NOT NULL DEFAULT 70,
  `readiness_score` int NOT NULL DEFAULT 0,
  `auto_apply_eligible` int NOT NULL DEFAULT 0,
  `blockers` text,
  `next_actions` text,
  `last_plan_summary` text,
  `last_synced_at` timestamp NOT NULL DEFAULT (now()),
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `application_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `application_campaigns_user_unique` ON `application_campaigns` (`user_id`);
--> statement-breakpoint
CREATE INDEX `application_campaigns_status_idx` ON `application_campaigns` (`status`);
--> statement-breakpoint
CREATE INDEX `application_campaigns_synced_idx` ON `application_campaigns` (`last_synced_at`);
