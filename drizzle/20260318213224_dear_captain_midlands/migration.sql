PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_read_statuses` (
	`instance_id` text NOT NULL,
	`session_id` text NOT NULL,
	`last_read_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `session_read_statuses_pk` PRIMARY KEY(`instance_id`, `session_id`)
);
--> statement-breakpoint
INSERT INTO `__new_session_read_statuses`(`instance_id`, `session_id`, `last_read_at`, `created_at`, `updated_at`)
SELECT
	`instance_id`,
	`session_id`,
	MAX(`last_read_at`) AS `last_read_at`,
	MIN(`created_at`) AS `created_at`,
	MAX(`updated_at`) AS `updated_at`
FROM `session_read_statuses`
GROUP BY `instance_id`, `session_id`;--> statement-breakpoint
DROP TABLE `session_read_statuses`;--> statement-breakpoint
ALTER TABLE `__new_session_read_statuses` RENAME TO `session_read_statuses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_session_read_statuses_viewer_updated_at`;--> statement-breakpoint
CREATE INDEX `idx_session_read_statuses_updated_at` ON `session_read_statuses` (`updated_at`);
