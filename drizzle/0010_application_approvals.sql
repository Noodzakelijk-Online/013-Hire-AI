CREATE TABLE `application_approvals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `application_id` int,
  `entity_type` enum('application','follow_up','success_fee','profile','billing') NOT NULL,
  `entity_id` int NOT NULL,
  `approval_type` enum('application_submission','follow_up_send','offer_attribution','profile_claim','billing_action') NOT NULL,
  `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `risk_level` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `requested_by` enum('system','user','admin') NOT NULL DEFAULT 'system',
  `decided_by` enum('user','admin'),
  `title` varchar(255) NOT NULL,
  `description` text,
  `payload` text,
  `decision_note` text,
  `requested_at` timestamp NOT NULL DEFAULT (now()),
  `decided_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `application_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `application_approvals_user_status_idx` ON `application_approvals` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `application_approvals_application_idx` ON `application_approvals` (`application_id`);
--> statement-breakpoint
CREATE INDEX `application_approvals_entity_idx` ON `application_approvals` (`entity_type`,`entity_id`);
