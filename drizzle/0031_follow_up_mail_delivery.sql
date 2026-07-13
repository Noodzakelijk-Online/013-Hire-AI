ALTER TABLE `follow_ups` ADD `delivery_provider` enum('gmail','outlook');
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `delivery_state` enum('draft','sending','sent','failed','unknown') NOT NULL DEFAULT 'draft';
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `delivery_recipient` varchar(320);
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `delivery_subject` varchar(500);
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `delivery_message_id` varchar(320);
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `delivery_attempt_key` varchar(64);
--> statement-breakpoint
ALTER TABLE `follow_ups` ADD `delivery_failure_message` varchar(500);
--> statement-breakpoint
CREATE UNIQUE INDEX `follow_ups_delivery_attempt_key_unique` ON `follow_ups` (`delivery_attempt_key`);
--> statement-breakpoint
CREATE INDEX `follow_ups_delivery_state_idx` ON `follow_ups` (`delivery_state`);
