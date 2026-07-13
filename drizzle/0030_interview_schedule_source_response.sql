ALTER TABLE `interview_schedules` ADD COLUMN `employer_response_id` int;
--> statement-breakpoint
CREATE INDEX `interview_schedules_employer_response_id_idx` ON `interview_schedules` (`employer_response_id`);
--> statement-breakpoint
ALTER TABLE `interview_schedules` ADD CONSTRAINT `interview_schedules_employer_response_id_employer_responses_id_fk` FOREIGN KEY (`employer_response_id`) REFERENCES `employer_responses`(`id`) ON DELETE SET NULL;
