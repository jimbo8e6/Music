CREATE TABLE `comments` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  `entry_id` INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  `parent_id` INTEGER,
  `body` TEXT NOT NULL,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `comments_entry_idx` ON `comments` (`entry_id`);
--> statement-breakpoint
CREATE INDEX `comments_user_idx` ON `comments` (`user_id`);
