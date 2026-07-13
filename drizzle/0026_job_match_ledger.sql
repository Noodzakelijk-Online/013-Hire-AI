ALTER TABLE `job_matches` ADD `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
DELETE older_match FROM `job_matches` AS older_match
INNER JOIN `job_matches` AS newer_match
  ON older_match.`user_id` = newer_match.`user_id`
  AND older_match.`job_id` = newer_match.`job_id`
  AND (
    older_match.`created_at` < newer_match.`created_at`
    OR (older_match.`created_at` = newer_match.`created_at` AND older_match.`id` < newer_match.`id`)
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `job_matches_user_job_unique` ON `job_matches` (`user_id`, `job_id`);
--> statement-breakpoint
CREATE INDEX `job_matches_user_score_idx` ON `job_matches` (`user_id`, `match_score`);
