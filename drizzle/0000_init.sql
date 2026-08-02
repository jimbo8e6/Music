CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`mbid` text,
	`title` text NOT NULL,
	`artist_name` text NOT NULL,
	`artist_mbid` text,
	`release_date` text,
	`year` integer,
	`primary_type` text,
	`secondary_types` text,
	`genres` text,
	`track_count` integer,
	`cover_art_url` text,
	`cover_art_checked_at` integer,
	`cached_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_mbid_idx` ON `albums` (`mbid`);--> statement-breakpoint
CREATE INDEX `albums_artist_idx` ON `albums` (`artist_name`);--> statement-breakpoint
CREATE INDEX `albums_title_idx` ON `albums` (`title`);--> statement-breakpoint
CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`album_id` text NOT NULL,
	`rating` integer,
	`review_title` text,
	`review_text` text,
	`listened_on` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_draft` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_user_album_idx` ON `entries` (`user_id`,`album_id`);--> statement-breakpoint
CREATE INDEX `entries_user_updated_idx` ON `entries` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `entries_user_rating_idx` ON `entries` (`user_id`,`rating`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text,
	`avatar_url` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `watchlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`album_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `watchlist_user_album_idx` ON `watchlist` (`user_id`,`album_id`);