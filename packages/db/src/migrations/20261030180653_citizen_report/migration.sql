CREATE TABLE `iathon_kiro_citizen_report` (
	`id` varchar(36) PRIMARY KEY,
	`description` text NOT NULL,
	`longitude` double NOT NULL,
	`latitude` double NOT NULL,
	`photo_key` varchar(255),
	`hazard_kind` varchar(32) NOT NULL,
	`priority` varchar(32) NOT NULL,
	`is_example` boolean NOT NULL DEFAULT false,
	`reporter_user_id` varchar(36),
	`created_at` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE TABLE `iathon_kiro_contingency_plan` (
	`report_id` varchar(36) PRIMARY KEY,
	`plan` json NOT NULL,
	`source` varchar(32) NOT NULL,
	`generated_at` timestamp(3) NOT NULL DEFAULT (now())
);
--> statement-breakpoint
CREATE INDEX `citizen_report_created_at_idx` ON `iathon_kiro_citizen_report` (`created_at`);