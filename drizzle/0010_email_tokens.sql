ALTER TABLE `users` ADD `email_verified` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE `email_tokens` (
  `id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  `token` TEXT NOT NULL,
  `type` TEXT NOT NULL,
  `expires_at` INTEGER NOT NULL,
  `created_at` INTEGER NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_tokens_token_idx` ON `email_tokens` (`token`);
--> statement-breakpoint
CREATE INDEX `email_tokens_user_idx` ON `email_tokens` (`user_id`);
