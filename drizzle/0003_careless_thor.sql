CREATE TABLE `education_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`degree` varchar(255) NOT NULL,
	`field_of_study` varchar(255),
	`institution` varchar(255) NOT NULL,
	`location` varchar(255),
	`start_date` timestamp,
	`end_date` timestamp,
	`is_current` int DEFAULT 0,
	`gpa` varchar(20),
	`achievements` text,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `education_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`url` varchar(500),
	`technologies` text,
	`start_date` timestamp,
	`end_date` timestamp,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`skill_name` varchar(100) NOT NULL,
	`category` varchar(100),
	`proficiency` enum('beginner','intermediate','advanced','expert') DEFAULT 'intermediate',
	`years_of_experience` int,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_skills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_experiences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`job_title` varchar(255) NOT NULL,
	`company` varchar(255) NOT NULL,
	`location` varchar(255),
	`start_date` timestamp NOT NULL,
	`end_date` timestamp,
	`is_current` int DEFAULT 0,
	`description` text,
	`achievements` text,
	`skills` text,
	`sort_order` int DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_experiences_id` PRIMARY KEY(`id`)
);
