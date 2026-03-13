CREATE TABLE `instances` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`directory` text NOT NULL,
	`port` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_started_at` text,
	`last_exit_at` text,
	`last_error` text,
	CONSTRAINT "instances_status_check" CHECK("status" in ('starting', 'running', 'stopped', 'error'))
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_passkeys` (
	`id` text PRIMARY KEY,
	`webauthn_user_id` text NOT NULL,
	`public_key` blob NOT NULL,
	`counter` integer NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` integer NOT NULL,
	`transports_json` text NOT NULL,
	`label` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`activated_at` text,
	`revoked_at` text,
	CONSTRAINT "passkeys_status_check" CHECK("status" in ('pending', 'active', 'revoked'))
);
--> statement-breakpoint
INSERT INTO `__new_passkeys`(`id`, `webauthn_user_id`, `public_key`, `counter`, `device_type`, `backed_up`, `transports_json`, `label`, `status`, `created_at`, `activated_at`, `revoked_at`) SELECT `id`, `webauthn_user_id`, `public_key`, `counter`, `device_type`, `backed_up`, `transports_json`, `label`, `status`, `created_at`, `activated_at`, `revoked_at` FROM `passkeys`;--> statement-breakpoint
DROP TABLE `passkeys`;--> statement-breakpoint
ALTER TABLE `__new_passkeys` RENAME TO `passkeys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_passkeys_status` ON `passkeys` (`status`);--> statement-breakpoint
CREATE INDEX `idx_instances_status` ON `instances` (`status`);