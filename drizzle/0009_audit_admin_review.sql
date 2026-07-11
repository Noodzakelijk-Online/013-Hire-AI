CREATE TABLE `audit_events` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `entity_type` enum('job','application','success_fee','verification','user','admin_review') NOT NULL,
  `entity_id` int NOT NULL,
  `action` varchar(120) NOT NULL,
  `actor` enum('system','user','admin') NOT NULL DEFAULT 'system',
  `source` varchar(120),
  `before_state` text,
  `after_state` text,
  `risk_level` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `approval_id` int,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_events_user_created_idx` ON `audit_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `audit_events_entity_idx` ON `audit_events` (`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE TABLE `admin_review_items` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `entity_type` enum('job','application','success_fee','verification','user') NOT NULL,
  `entity_id` int NOT NULL,
  `category` enum('application_review','submission_evidence','employer_response','offer_attribution','verification_overdue','payment_failed','legal_escalation') NOT NULL,
  `status` enum('open','in_progress','resolved','dismissed') NOT NULL DEFAULT 'open',
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `title` varchar(255) NOT NULL,
  `description` text,
  `assigned_to` int,
  `resolved_by` int,
  `resolved_at` timestamp,
  `resolution` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `admin_review_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `admin_review_items_status_priority_idx` ON `admin_review_items` (`status`,`priority`);
--> statement-breakpoint
CREATE INDEX `admin_review_items_user_status_idx` ON `admin_review_items` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `admin_review_items_entity_idx` ON `admin_review_items` (`entity_type`,`entity_id`);
