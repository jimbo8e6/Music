CREATE TABLE `mb_cache` (
	`url` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`fetched_at` integer NOT NULL
);
