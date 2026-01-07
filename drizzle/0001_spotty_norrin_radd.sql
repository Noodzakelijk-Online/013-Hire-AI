CREATE TABLE `applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`job_id` int NOT NULL,
	`status` enum('pending','applied','viewed','interview','offer','rejected','accepted','withdrawn') NOT NULL DEFAULT 'pending',
	`applied_date` timestamp,
	`last_activity` timestamp,
	`cover_letter` text,
	`custom_resume` text,
	`notes` text,
	`is_auto_applied` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `decision_makers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company` varchar(255) NOT NULL,
	`name` varchar(255),
	`title` varchar(255),
	`email` varchar(320),
	`linkedin_url` varchar(500),
	`department` varchar(100),
	`verification_source` varchar(100),
	`is_verified` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decision_makers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follow_ups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`message` text,
	`sent_date` timestamp,
	`response_received` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follow_ups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_preparation` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`job_id` int NOT NULL,
	`questions` text,
	`coaching_tips` text,
	`company_insights` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interview_preparation_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_duplicates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`primary_job_id` int NOT NULL,
	`duplicate_job_id` int NOT NULL,
	`similarity_score` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_duplicates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`job_id` int NOT NULL,
	`match_score` int NOT NULL,
	`match_reasons` text,
	`skills_match` int,
	`experience_match` int,
	`location_match` int,
	`salary_match` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_platforms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`url` varchar(500) NOT NULL,
	`tier` enum('tier1','tier2','tier3','tier4') NOT NULL,
	`category` varchar(100),
	`is_active` int NOT NULL DEFAULT 1,
	`last_scraped` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `job_platforms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`external_id` varchar(255),
	`title` varchar(500) NOT NULL,
	`company` varchar(255) NOT NULL,
	`description` text,
	`requirements` text,
	`responsibilities` text,
	`benefits` text,
	`location` varchar(255),
	`job_type` enum('full-time','part-time','contract','temporary'),
	`salary_min` int,
	`salary_max` int,
	`salary_currency` varchar(10),
	`skills` text,
	`application_url` varchar(1000),
	`application_email` varchar(320),
	`application_process` varchar(100),
	`platform_id` int NOT NULL,
	`source_url` varchar(1000),
	`posted_date` timestamp,
	`expiry_date` timestamp,
	`is_active` int NOT NULL DEFAULT 1,
	`visa_sponsorship_available` int DEFAULT 0,
	`open_hiring_support` int DEFAULT 0,
	`diversity_friendly` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_media_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`platform` enum('facebook','twitter','linkedin') NOT NULL,
	`profile_url` varchar(500),
	`access_token` text,
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_media_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`skills` text,
	`experience` text,
	`education` text,
	`preferences` text,
	`desired_job_types` text,
	`desired_locations` text,
	`salary_expectation_min` int,
	`salary_expectation_max` int,
	`resume_url` varchar(1000),
	`resume_file_key` varchar(500),
	`linkedin_url` varchar(500),
	`github_url` varchar(500),
	`portfolio_url` varchar(500),
	`diversity_group` varchar(255),
	`needs_visa_sponsorship` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
