ALTER TABLE `job_platforms` ADD `last_scrape_attempted_at` timestamp;
--> statement-breakpoint
ALTER TABLE `job_platforms` ADD `last_scrape_status` enum('success','partial','failed');
--> statement-breakpoint
ALTER TABLE `job_platforms` ADD `last_scrape_job_count` int;
--> statement-breakpoint
ALTER TABLE `job_platforms` ADD `last_scrape_error` varchar(2000);
