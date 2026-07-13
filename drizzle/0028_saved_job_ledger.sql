ALTER TABLE `saved_jobs` ADD `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
--> statement-breakpoint
DELETE older_saved_job
FROM `saved_jobs` AS older_saved_job
INNER JOIN `saved_jobs` AS newer_saved_job
  ON older_saved_job.`user_id` = newer_saved_job.`user_id`
  AND older_saved_job.`job_id` = newer_saved_job.`job_id`
  AND (
    older_saved_job.`created_at` < newer_saved_job.`created_at`
    OR (
      older_saved_job.`created_at` = newer_saved_job.`created_at`
      AND older_saved_job.`id` < newer_saved_job.`id`
    )
  );
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_jobs_user_job_unique` ON `saved_jobs` (`user_id`, `job_id`);
--> statement-breakpoint
CREATE INDEX `saved_jobs_user_updated_idx` ON `saved_jobs` (`user_id`, `updated_at`);
