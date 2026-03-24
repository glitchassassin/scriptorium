PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_read_statuses` (
	`session_id` text PRIMARY KEY NOT NULL,
	`last_read_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_session_read_statuses`(`session_id`, `last_read_at`, `created_at`, `updated_at`)
SELECT
	`session_id`,
	MAX(`last_read_at`) AS `last_read_at`,
	MIN(`created_at`) AS `created_at`,
	MAX(`updated_at`) AS `updated_at`
FROM `session_read_statuses`
GROUP BY `session_id`;--> statement-breakpoint
DROP TABLE `session_read_statuses`;--> statement-breakpoint
ALTER TABLE `__new_session_read_statuses` RENAME TO `session_read_statuses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_session_read_statuses_updated_at` ON `session_read_statuses` (`updated_at`);
