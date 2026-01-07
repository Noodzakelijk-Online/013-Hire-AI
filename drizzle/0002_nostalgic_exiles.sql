CREATE TABLE `application_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`note_type` enum('general','interview','followup','research','feedback') DEFAULT 'general',
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `application_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interview_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`application_id` int NOT NULL,
	`interview_type` enum('phone','video','onsite','technical','behavioral','panel') NOT NULL,
	`scheduled_at` timestamp NOT NULL,
	`duration` int,
	`location` varchar(500),
	`meeting_link` varchar(500),
	`interviewer_name` varchar(255),
	`interviewer_title` varchar(255),
	`notes` text,
	`status` enum('scheduled','completed','cancelled','rescheduled') DEFAULT 'scheduled',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `interview_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`keywords` text,
	`locations` text,
	`platforms` text,
	`min_salary` int,
	`job_types` text,
	`frequency` enum('instant','daily','weekly') DEFAULT 'daily',
	`is_active` int NOT NULL DEFAULT 1,
	`last_triggered` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`job_id` int NOT NULL,
	`notes` text,
	`tags` text,
	`priority` enum('low','medium','high') DEFAULT 'medium',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_resumes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` varchar(1000) NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_size` int NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`is_active` int NOT NULL DEFAULT 1,
	`uploaded_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_resumes_id` PRIMARY KEY(`id`)
);
