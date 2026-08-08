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
  email: text("email"),
  passwordHash: text("password_hash"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  /** Default sort for the Ratings tab in /library. Matches LibrarySort values. */
  defaultLibrarySort: text("default_library_sort").default("recent"),
  /** Default sort for the Collection tab in /library. Matches CollectionSort values. */
  defaultCollectionSort: text("default_collection_sort").default("recent"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("users_username_idx").on(t.username),
  uniqueIndex("users_email_idx").on(t.email),
]);

/** Time-limited tokens for email verification and password reset. */
export const emailTokens = sqliteTable("email_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  type: text("type").notNull(), // 'verify' | 'reset'
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("email_tokens_token_idx").on(t.token),
  index("email_tokens_user_idx").on(t.userId),
]);

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
  /**
   * Where to hear it. Null means nobody has looked yet; an empty object means
   * we looked and MusicBrainz had no streaming links for this release group.
   */
  externalUrls: text("external_urls", { mode: "json" }).$type<{
    spotify?: string;
    appleMusic?: string;
    deezer?: string;
    bandcamp?: string;
    youtube?: string;
  }>(),
  /** Spotify artist ID, populated for albums sourced via Spotify. */
  artistSpotifyId: text("artist_spotify_id"),
  /** Cover Art Archive front image, Spotify CDN URL, or null. */
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

/** Who follows whom. One row per (follower, following) pair. */
export const follows = sqliteTable("follows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("follows_pair_idx").on(t.followerId, t.followingId),
  index("follows_follower_idx").on(t.followerId),
  index("follows_following_idx").on(t.followingId),
]);

/** Physical formats the user owns an album on. Independent of ratings. */
export const collection = sqliteTable("collection", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  albumId: text("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),
  formats: text("formats", { mode: "json" }).$type<string[]>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [uniqueIndex("collection_user_album_idx").on(t.userId, t.albumId)]);

/** Up to 4 pinned favourite albums shown at the top of a user's profile. */
export const favourites = sqliteTable("favourites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  albumId: text("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),
  position: integer("position").notNull(), // 1–4
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("favourites_user_position_idx").on(t.userId, t.position),
]);

/** Comments on a user's logged entry (review). Two-level: top-level + replies. */
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entryId: integer("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"), // null = top-level; int = reply to that comment id
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("comments_entry_idx").on(t.entryId),
  index("comments_user_idx").on(t.userId),
]);

/** In-app notifications: replies to comments and new comments on entries. */
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'reply' | 'comment'
  actorId: text("actor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").references(() => comments.id, { onDelete: "cascade" }),
  entryId: integer("entry_id").references(() => entries.id, { onDelete: "cascade" }),
  albumId: text("album_id").references(() => albums.id, { onDelete: "cascade" }),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  index("notifications_user_idx").on(t.userId),
  index("notifications_user_read_idx").on(t.userId, t.read),
]);

/** Likes on individual comments. */
export const commentLikes = sqliteTable("comment_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("comment_likes_user_comment_idx").on(t.userId, t.commentId),
  index("comment_likes_comment_idx").on(t.commentId),
]);

/** Likes on other users' reviews. */
export const reviewLikes = sqliteTable("review_likes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entryId: integer("entry_id").notNull().references(() => entries.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
}, (t) => [
  uniqueIndex("review_likes_user_entry_idx").on(t.userId, t.entryId),
  index("review_likes_entry_idx").on(t.entryId),
]);

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

export type Comment = typeof comments.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;
export type EmailToken = typeof emailTokens.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type ReviewLike = typeof reviewLikes.$inferSelect;
export type User = typeof users.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type NewAlbum = typeof albums.$inferInsert;
export type Entry = typeof entries.$inferSelect;
export type CollectionEntry = typeof collection.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Favourite = typeof favourites.$inferSelect;
