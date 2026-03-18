CREATE TABLE `session_read_statuses` (
	`viewer_id` text NOT NULL,
	`instance_id` text NOT NULL,
	`session_id` text NOT NULL,
	`last_read_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `session_read_statuses_pk` PRIMARY KEY(`viewer_id`, `instance_id`, `session_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_session_read_statuses_viewer_updated_at` ON `session_read_statuses` (`viewer_id`,`updated_at`);