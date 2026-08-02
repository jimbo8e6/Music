import { and, avg, count, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db, getCurrentUser, schema } from "@/db";
import type { Album, Entry } from "@/db/schema";
import { lookupAlbum } from "@/lib/musicbrainz";

export interface EntryWithAlbum {
  entry: Entry;
  album: Album;
}

const { albums, entries, watchlist } = schema;

/**
 * Returns the cached album, fetching and caching it from MusicBrainz on a miss.
 * Every page that shows an album goes through here, so the local DB fills up
 * with exactly the albums the user cares about and nothing else.
 */
export async function getOrFetchAlbum(id: string): Promise<Album | null> {
  const cached = await getAlbum(id);
  if (cached) return cached;

  // Only MBIDs are resolvable upstream; `local-…` ids must already exist.
  if (id.startsWith("local-")) return null;

  const detail = await lookupAlbum(id);

  const inserted = await db
    .insert(albums)
    .values({
      id: detail.mbid,
      mbid: detail.mbid,
      title: detail.title,
      artistName: detail.artistName,
      artistMbid: detail.artistMbid,
      releaseDate: detail.releaseDate,
      year: detail.year,
      primaryType: detail.primaryType,
      secondaryTypes: detail.secondaryTypes,
      genres: detail.genres,
      trackCount: detail.trackCount,
    })
    .onConflictDoUpdate({
      target: albums.id,
      set: { title: detail.title, artistName: detail.artistName },
    })
    .returning()
    .get();

  return inserted ?? null;
}

export async function getAlbum(id: string): Promise<Album | undefined> {
  await getCurrentUser();
  return db.select().from(albums).where(eq(albums.id, id)).get();
}

export async function getEntryForAlbum(albumId: string): Promise<Entry | undefined> {
  const user = await getCurrentUser();
  return db
    .select()
    .from(entries)
    .where(and(eq(entries.userId, user.id), eq(entries.albumId, albumId)))
    .get();
}

export type LibrarySort = "recent" | "rating" | "title" | "artist" | "year";

export async function getEntries({
  limit,
  sort = "recent",
  ratedOnly = false,
  reviewedOnly = false,
}: {
  limit?: number;
  sort?: LibrarySort;
  ratedOnly?: boolean;
  reviewedOnly?: boolean;
} = {}): Promise<EntryWithAlbum[]> {
  const user = await getCurrentUser();

  const conditions = [eq(entries.userId, user.id)];
  if (ratedOnly) conditions.push(isNotNull(entries.rating));
  if (reviewedOnly) conditions.push(sql`length(trim(coalesce(${entries.reviewText}, ''))) > 0`);

  const orderBy = {
    recent: [desc(entries.updatedAt)],
    // Unrated entries sort last rather than as if they were zero stars.
    rating: [sql`${entries.rating} is null`, desc(entries.rating), desc(entries.updatedAt)],
    title: [albums.title],
    artist: [albums.artistName, albums.year],
    year: [desc(albums.year)],
  }[sort];

  const query = db
    .select({ entry: entries, album: albums })
    .from(entries)
    .innerJoin(albums, eq(entries.albumId, albums.id))
    .where(and(...conditions))
    .orderBy(...orderBy);

  return limit ? query.limit(limit) : query;
}

export async function getEntryById(id: number): Promise<EntryWithAlbum | undefined> {
  const user = await getCurrentUser();
  return db
    .select({ entry: entries, album: albums })
    .from(entries)
    .innerJoin(albums, eq(entries.albumId, albums.id))
    .where(and(eq(entries.userId, user.id), eq(entries.id, id)))
    .get();
}

export interface LibraryStats {
  logged: number;
  rated: number;
  reviewed: number;
  averageRating: number | null;
  /** Count of entries per half-star value, index 0 = 0.5 stars … index 9 = 5. */
  distribution: number[];
}

export async function getStats(): Promise<LibraryStats> {
  const user = await getCurrentUser();
  const mine = eq(entries.userId, user.id);

  const totals = await db
    .select({
      logged: count(),
      rated: sql<number>`sum(case when ${entries.rating} is not null then 1 else 0 end)`,
      reviewed: sql<number>`sum(case when length(trim(coalesce(${entries.reviewText}, ''))) > 0 then 1 else 0 end)`,
      averageRating: avg(entries.rating),
    })
    .from(entries)
    .where(mine)
    .get();

  const buckets = await db
    .select({ rating: entries.rating, total: count() })
    .from(entries)
    .where(and(mine, isNotNull(entries.rating)))
    .groupBy(entries.rating);

  const distribution = Array<number>(10).fill(0);
  for (const bucket of buckets) {
    if (bucket.rating) distribution[bucket.rating - 1] = bucket.total;
  }

  const average = totals?.averageRating;

  return {
    logged: totals?.logged ?? 0,
    rated: Number(totals?.rated ?? 0),
    reviewed: Number(totals?.reviewed ?? 0),
    averageRating: average === null || average === undefined ? null : Number(average),
    distribution,
  };
}

export async function getWatchlist(): Promise<Album[]> {
  const user = await getCurrentUser();
  const rows = await db
    .select({ album: albums })
    .from(watchlist)
    .innerJoin(albums, eq(watchlist.albumId, albums.id))
    .where(eq(watchlist.userId, user.id))
    .orderBy(desc(watchlist.createdAt));

  return rows.map((row) => row.album);
}

export async function isOnWatchlist(albumId: string): Promise<boolean> {
  const user = await getCurrentUser();
  const row = await db
    .select({ id: watchlist.id })
    .from(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.albumId, albumId)))
    .get();
  return Boolean(row);
}
