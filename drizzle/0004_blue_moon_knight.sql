CREATE TABLE `employment_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`success_fee_id` int NOT NULL,
	`user_id` int NOT NULL,
	`verification_type` enum('initial','quarterly') NOT NULL DEFAULT 'initial',
	`document_url` varchar(1000),
	`document_key` varchar(500),
	`document_type` enum('offer_letter','paystub','employment_letter','bank_statement','other') DEFAULT 'offer_letter',
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewed_at` timestamp,
	`review_notes` text,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employment_verifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fee_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`success_fee_id` int NOT NULL,
	`user_id` int NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`stripe_payment_intent_id` varchar(255),
	`stripe_invoice_id` varchar(255),
	`status` enum('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`period_start` timestamp,
	`period_end` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fee_payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `success_fees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`application_id` int,
	`employer_name` varchar(255) NOT NULL,
	`job_title` varchar(255) NOT NULL,
	`monthly_salary` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`fee_percent` int NOT NULL DEFAULT 5,
	`monthly_fee_amount` int NOT NULL,
	`stripe_subscription_id` varchar(255),
	`stripe_price_id` varchar(255),
	`status` enum('pending_verification','active','paused','ended','suspended','disputed') NOT NULL DEFAULT 'pending_verification',
	`start_date` timestamp NOT NULL,
	`end_date` timestamp,
	`next_verification_due` timestamp,
	`verification_grace_expiry` timestamp,
	`offer_letter_url` varchar(1000),
	`offer_letter_key` varchar(500),
	`terms_accepted_at` timestamp,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `success_fees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `account_status` enum('active','suspended','pending') DEFAULT 'active' NOT NULL;