CREATE TEMPORARY TABLE `application_canonical_ids` AS
SELECT
  `user_id`,
  `job_id`,
  MIN(`id`) AS `canonical_id`,
  MAX(CASE `status`
    WHEN 'accepted' THEN 8
    WHEN 'offer' THEN 7
    WHEN 'interview' THEN 6
    WHEN 'viewed' THEN 5
    WHEN 'applied' THEN 4
    WHEN 'rejected' THEN 3
    WHEN 'withdrawn' THEN 2
    ELSE 1
  END) AS `status_rank`,
  MIN(`applied_date`) AS `applied_date`,
  MAX(`last_activity`) AS `last_activity`,
  MAX(`cover_letter`) AS `cover_letter`,
  MAX(`custom_resume`) AS `custom_resume`,
  MAX(`notes`) AS `notes`,
  MAX(`is_auto_applied`) AS `is_auto_applied`
FROM `applications`
GROUP BY `user_id`, `job_id`;
--> statement-breakpoint
UPDATE `applications` AS `application`
INNER JOIN `application_canonical_ids` AS `canonical`
  ON `application`.`id` = `canonical`.`canonical_id`
SET
  `application`.`status` = CASE `canonical`.`status_rank`
    WHEN 8 THEN 'accepted'
    WHEN 7 THEN 'offer'
    WHEN 6 THEN 'interview'
    WHEN 5 THEN 'viewed'
    WHEN 4 THEN 'applied'
    WHEN 3 THEN 'rejected'
    WHEN 2 THEN 'withdrawn'
    ELSE 'pending'
  END,
  `application`.`applied_date` = COALESCE(`application`.`applied_date`, `canonical`.`applied_date`),
  `application`.`last_activity` = COALESCE(`canonical`.`last_activity`, `application`.`last_activity`),
  `application`.`cover_letter` = COALESCE(`application`.`cover_letter`, `canonical`.`cover_letter`),
  `application`.`custom_resume` = COALESCE(`application`.`custom_resume`, `canonical`.`custom_resume`),
  `application`.`notes` = COALESCE(`application`.`notes`, `canonical`.`notes`),
  `application`.`is_auto_applied` = GREATEST(
    COALESCE(`application`.`is_auto_applied`, 0),
    COALESCE(`canonical`.`is_auto_applied`, 0)
  );
--> statement-breakpoint
UPDATE `application_notes` AS `dependent`
INNER JOIN `applications` AS `duplicate` ON `dependent`.`application_id` = `duplicate`.`id`
INNER JOIN `application_canonical_ids` AS `canonical`
  ON `duplicate`.`user_id` = `canonical`.`user_id`
  AND `duplicate`.`job_id` = `canonical`.`job_id`
SET `dependent`.`application_id` = `canonical`.`canonical_id`
WHERE `dependent`.`application_id` <> `canonical`.`canonical_id`;
--> statement-breakpoint
UPDATE `interview_schedules` AS `dependent`
INNER JOIN `applications` AS `duplicate` ON `dependent`.`application_id` = `duplicate`.`id`
INNER JOIN `application_canonical_ids` AS `canonical`
  ON `duplicate`.`user_id` = `canonical`.`user_id`
  AND `duplicate`.`job_id` = `canonical`.`job_id`
SET `dependent`.`application_id` = `canonical`.`canonical_id`
WHERE `dependent`.`application_id` <> `canonical`.`canonical_id`;
--> statement-breakpoint
UPDATE `follow_ups` AS `dependent`
INNER JOIN `applications` AS `duplicate` ON `dependent`.`application_id` = `duplicate`.`id`
INNER JOIN `application_canonical_ids` AS `canonical`
  ON `duplicate`.`user_id` = `canonical`.`user_id`
  AND `duplicate`.`job_id` = `canonical`.`job_id`
SET `dependent`.`application_id` = `canonical`.`canonical_id`
WHERE `dependent`.`application_id` <> `canonical`.`canonical_id`;
--> statement-breakpoint
UPDATE `success_fees` AS `dependent`
INNER JOIN `applications` AS `duplicate` ON `dependent`.`application_id` = `duplicate`.`id`
INNER JOIN `application_canonical_ids` AS `canonical`
  ON `duplicate`.`user_id` = `canonical`.`user_id`
  AND `duplicate`.`job_id` = `canonical`.`job_id`
SET `dependent`.`application_id` = `canonical`.`canonical_id`
WHERE `dependent`.`application_id` <> `canonical`.`canonical_id`;
--> statement-breakpoint
DELETE `duplicate`
FROM `applications` AS `duplicate`
INNER JOIN `application_canonical_ids` AS `canonical`
  ON `duplicate`.`user_id` = `canonical`.`user_id`
  AND `duplicate`.`job_id` = `canonical`.`job_id`
WHERE `duplicate`.`id` <> `canonical`.`canonical_id`;
--> statement-breakpoint
DROP TEMPORARY TABLE `application_canonical_ids`;
--> statement-breakpoint
ALTER TABLE `applications` ADD CONSTRAINT `applications_user_job_unique` UNIQUE(`user_id`,`job_id`);
