CREATE TABLE `notifications` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `type` TEXT NOT NULL,
  `actor_id` TEXT NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `comment_id` INTEGER REFERENCES `comments`(`id`) ON DELETE CASCADE,
  `entry_id` INTEGER REFERENCES `entries`(`id`) ON DELETE CASCADE,
  `album_id` TEXT REFERENCES `albums`(`id`) ON DELETE CASCADE,
  `read` INTEGER NOT NULL DEFAULT 0,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`);
--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`, `read`);
