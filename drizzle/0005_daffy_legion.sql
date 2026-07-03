CREATE TABLE `autonomous_run_states` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`lease_token` varchar(64),
	`lease_expires_at` timestamp,
	`last_started_at` timestamp,
	`last_completed_at` timestamp,
	`last_status` enum('running','completed','failed'),
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `autonomous_run_states_id` PRIMARY KEY(`id`),
	CONSTRAINT `autonomous_run_states_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `tos_accepted_at` timestamp;--> statement-breakpoint
CREATE INDEX `autonomous_run_states_lease_expires_idx` ON `autonomous_run_states` (`lease_expires_at`);