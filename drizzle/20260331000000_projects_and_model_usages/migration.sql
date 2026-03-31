PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`directory` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
INSERT INTO `projects`(`id`, `name`, `directory`, `created_at`, `updated_at`)
SELECT `id`, `name`, `directory`, `created_at`, `updated_at`
FROM `instances`;
--> statement-breakpoint
DROP TABLE `instances`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_instances_status`;--> statement-breakpoint
CREATE INDEX `idx_projects_directory` ON `projects` (`directory`);

PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_model_usages_instance_used_at`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_model_usages_session`;--> statement-breakpoint
CREATE TABLE `__new_model_usages` (
	`project_id` text NOT NULL,
	`session_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`variant` text,
	`used_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `session_id`, `provider_id`, `model_id`)
);
INSERT INTO `__new_model_usages`(`project_id`, `session_id`, `provider_id`, `model_id`, `variant`, `used_at`, `created_at`, `updated_at`)
SELECT `instance_id`, `session_id`, `provider_id`, `model_id`, `variant`, `used_at`, `created_at`, `updated_at`
FROM `model_usages`;
--> statement-breakpoint
DROP TABLE `model_usages`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_model_usages_used_at`;--> statement-breakpoint
ALTER TABLE `__new_model_usages` RENAME TO `model_usages`;--> statement-breakpoint
CREATE INDEX `idx_model_usages_project_used_at` ON `model_usages` (`project_id`, `used_at`);
CREATE INDEX `idx_model_usages_session` ON `model_usages` (`project_id`, `session_id`);
CREATE INDEX `idx_model_usages_used_at` ON `model_usages` (`used_at`);
PRAGMA foreign_keys=ON;
