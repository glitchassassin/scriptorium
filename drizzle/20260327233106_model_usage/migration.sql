CREATE TABLE `model_usages` (
	`instance_id` text NOT NULL,
	`session_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`variant` text,
	`used_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `model_usages_pk` PRIMARY KEY(`instance_id`, `session_id`, `provider_id`, `model_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_model_usages_instance_used_at` ON `model_usages` (`instance_id`,`used_at`);--> statement-breakpoint
CREATE INDEX `idx_model_usages_session` ON `model_usages` (`instance_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_model_usages_used_at` ON `model_usages` (`used_at`);