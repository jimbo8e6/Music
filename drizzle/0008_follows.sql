CREATE TABLE `follows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`follower_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`following_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `follows_pair_idx` ON `follows` (`follower_id`,`following_id`);
--> statement-breakpoint
CREATE INDEX `follows_follower_idx` ON `follows` (`follower_id`);
--> statement-breakpoint
CREATE INDEX `follows_following_idx` ON `follows` (`following_id`);
