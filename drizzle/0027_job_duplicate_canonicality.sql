DELETE conflicting_link
FROM `job_duplicates` AS conflicting_link
INNER JOIN `job_duplicates` AS preferred_link
  ON conflicting_link.`duplicate_job_id` = preferred_link.`duplicate_job_id`
  AND (
    conflicting_link.`primary_job_id` > preferred_link.`primary_job_id`
    OR (
      conflicting_link.`primary_job_id` = preferred_link.`primary_job_id`
      AND conflicting_link.`id` > preferred_link.`id`
    )
  );
--> statement-breakpoint
DELETE FROM `job_duplicates` WHERE `primary_job_id` = `duplicate_job_id`;
--> statement-breakpoint
CREATE UNIQUE INDEX `job_duplicates_duplicate_job_unique` ON `job_duplicates` (`duplicate_job_id`);
--> statement-breakpoint
DROP INDEX `job_duplicates_duplicate_job_idx` ON `job_duplicates`;
