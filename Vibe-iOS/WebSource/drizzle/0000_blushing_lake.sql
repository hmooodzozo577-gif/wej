CREATE TABLE `cinema_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`host_hash` text NOT NULL,
	`media` text NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`paused` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cinema_expiry_idx` ON `cinema_sessions` (`expires_at`);