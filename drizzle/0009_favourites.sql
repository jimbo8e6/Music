CREATE TABLE `favourites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`album_id` text NOT NULL REFERENCES `albums`(`id`) ON DELETE CASCADE,
	`position` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favourites_user_position_idx` ON `favourites` (`user_id`,`position`);
