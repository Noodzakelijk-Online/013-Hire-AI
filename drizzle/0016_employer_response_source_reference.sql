ALTER TABLE `employer_responses` ADD `source_reference` varchar(320);--> statement-breakpoint
CREATE UNIQUE INDEX `employer_responses_user_source_reference_unique` ON `employer_responses` (`user_id`,`source`,`source_reference`);
