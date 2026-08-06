CREATE TABLE `review_likes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE cascade,
	`entry_id` integer NOT NULL REFERENCES `entries`(`id`) ON DELETE cascade,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_likes_user_entry_idx` ON `review_likes` (`user_id`,`entry_id`);
--> statement-breakpoint
CREATE INDEX `review_likes_entry_idx` ON `review_likes` (`entry_id`);
