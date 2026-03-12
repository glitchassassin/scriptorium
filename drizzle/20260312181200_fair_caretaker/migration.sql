CREATE TABLE `activation_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`passkey_id` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`consumed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`passkey_id`) REFERENCES `passkeys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_activation_codes_passkey_id` ON `activation_codes` (`passkey_id`);--> statement-breakpoint
CREATE TABLE `authentication_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
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
	CONSTRAINT "passkeys_status_check" CHECK("passkeys"."status" in ('pending', 'active', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `idx_passkeys_status` ON `passkeys` (`status`);--> statement-breakpoint
CREATE TABLE `registration_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`label` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`passkey_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`passkey_id`) REFERENCES `passkeys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);