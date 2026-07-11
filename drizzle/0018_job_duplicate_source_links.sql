CREATE UNIQUE INDEX `job_duplicates_primary_duplicate_unique` ON `job_duplicates` (`primary_job_id`,`duplicate_job_id`);
--> statement-breakpoint
CREATE INDEX `job_duplicates_duplicate_job_idx` ON `job_duplicates` (`duplicate_job_id`);
