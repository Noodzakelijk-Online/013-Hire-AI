CREATE TABLE `connector_authorizations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `user_id` int NOT NULL,
  `provider` enum('gmail','google_drive','dropbox','outlook','linkedin','github') NOT NULL,
  `encrypted_access_token` text NOT NULL,
  `encrypted_refresh_token` text,
  `access_token_expires_at` timestamp,
  `token_type` varchar(64),
  `granted_scopes` text,
  `created_at` timestamp NOT NULL DEFAULT (now()),
  `updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `connector_authorizations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connector_authorizations_user_provider_unique` ON `connector_authorizations` (`user_id`,`provider`);
