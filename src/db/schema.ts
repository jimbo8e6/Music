import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * The app runs single-user today: `getCurrentUser()` always resolves the seeded
 * local account. Every user-owned row still carries `userId`, so turning on real
 * accounts is a matter of swapping that resolver for a session lookup — no
 * migration of existing data.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [uniqueIndex("users_username_idx").on(t.username)]);

/**
 * Local cache of albums (MusicBrainz release-groups) the user has actually
 * touched. `id` is the release-group MBID for anything that came from
 * MusicBrainz, and a `local-…` slug for hand-added entries, so the app works
 * with or without the upstream API.
 */
export const albums = sqliteTable("albums", {
  id: text("id").primaryKey(),
  mbid: text("mbid"),
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  artistMbid: text("artist_mbid"),
  /** Full release date as reported upstream, e.g. "2000-10-02". */
  releaseDate: text("release_date"),
  year: integer("year"),
  /** MusicBrainz primary type: Album, EP, Single, … */
  primaryType: text("primary_type"),
  /** JSON array of secondary types: Live, Compilation, Soundtrack, … */
  secondaryTypes: text("secondary_types", { mode: "json" }).$type<string[]>(),
  /** JSON array of genre/tag names. */
  genres: text("genres", { mode: "json" }).$type<string[]>(),
  trackCount: integer("track_count"),
  /** Release to ask for a tracklist; release-groups don't carry one. */
  primaryReleaseId: text("primary_release_id"),
  /** Set once the tracklist has been looked up, so a blank isn't retried forever. */
  trackCountCheckedAt: integer("track_count_checked_at", { mode: "timestamp" }),
  /** The tracklist itself, cached from the same request as the count. */
  tracks: text("tracks", { mode: "json" }).$type<
    { position: number; title: string; lengthMs: number | null; medium: number }[]
  >(),
  /** Cover Art Archive front image, or null when no art exists upstream. */
  coverArtUrl: text("cover_art_url"),
  /** Null until we have asked CAA at least once; prevents re-asking forever. */
  coverArtCheckedAt: integer("cover_art_checked_at", { mode: "timestamp" }),
  cachedAt: integer("cached_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("albums_mbid_idx").on(t.mbid),
  index("albums_artist_idx").on(t.artistName),
  index("albums_title_idx").on(t.title),
]);

/**
 * One row per (user, album): the rating, the review, and when it was listened
 * to. Re-rating an album updates this row rather than adding another, which is
 * what makes "your library" a simple join.
 */
export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  albumId: text("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),
  /**
   * Rating in half-stars: 1–10, where 10 is five stars. Null means logged or
   * reviewed without a score. Integer storage keeps sorting and averaging exact.
   */
  rating: integer("rating"),
  reviewTitle: text("review_title"),
  reviewText: text("review_text"),
  /** ISO date (YYYY-MM-DD) the user listened; null if they didn't say. */
  listenedOn: text("listened_on"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  /** Marks a review as containing spoilers-equivalent: unfinished thoughts. */
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("entries_user_album_idx").on(t.userId, t.albumId),
  index("entries_user_updated_idx").on(t.userId, t.updatedAt),
  index("entries_user_rating_idx").on(t.userId, t.rating),
]);

/**
 * Raw MusicBrainz responses, keyed by request URL.
 *
 * Next's own fetch cache is per-deployment and gets discarded; on a serverless
 * host every cold start begins with nothing, and the app pays the upstream cost
 * again. MusicBrainz allows one request per second per IP — and on a shared
 * host that IP is shared with everyone else on it — so the cheapest request is
 * the one never made.
 */
export const mbCache = sqliteTable("mb_cache", {
  url: text("url").primaryKey(),
  body: text("body").notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
});

/** Albums the user wants to hear but hasn't logged yet. */
export const watchlist = sqliteTable("watchlist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  albumId: text("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [uniqueIndex("watchlist_user_album_idx").on(t.userId, t.albumId)]);

export type User = typeof users.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Entry = typeof entries.$inferSelect;
