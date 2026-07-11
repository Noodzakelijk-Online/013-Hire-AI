CREATE TABLE `user_connector_accounts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `provider` enum('gmail','google_drive','dropbox','outlook','linkedin','github','portfolio') NOT NULL,
  `status` enum('not_connected','connection_requested','connected','needs_reauth','disabled') NOT NULL DEFAULT 'not_connected',
  `consent_scopes` text,
  `external_account_label` varchar(255),
  `connection_requested_at` timestamp,
  `last_verified_at` timestamp,
  `disconnected_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `user_connector_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_connector_accounts_user_provider_unique` ON `user_connector_accounts` (`user_id`,`provider`);
