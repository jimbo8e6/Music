import { cache } from "react";

import { and, avg, count, desc, eq, gt, isNotNull, like, sql } from "drizzle-orm";

import { db, getCurrentUser, ready, schema } from "@/db";
import type { Album, Entry } from "@/db/schema";
import {
  fetchExternalLinks,
  fetchRelease,
  getArtistReleaseGroups,
  lookupAlbum,
  mergeLinks,
  type AlbumSearchResult,
  type ExternalLinks,
  type Track,
} from "@/lib/musicbrainz";
import { getSpotifyAlbum, isSpotifyId } from "@/lib/spotify";

export interface EntryWithAlbum {
  entry: Entry;
  album: Album;
}

const { albums, entries, watchlist, collection, follows } = schema;

/**
 * Returns the cached album, fetching and caching it from MusicBrainz on a miss.
 * Every page that shows an album goes through here, so the local DB fills up
 * with exactly the albums the user cares about and nothing else.
 */
export const getOrFetchAlbum = cache(async (id: string): Promise<Album | null> => {
  const cached = await getAlbum(id);
  if (cached) return cached;

  // local-* entries must already exist in the DB
  if (id.startsWith("local-")) return null;

  // Spotify IDs (22-char base-62): fetch from Spotify
  if (isSpotifyId(id)) {
    const detail = await getSpotifyAlbum(id);

    // Map Spotify album_type to primaryType/secondaryTypes the app understands
    let primaryType = "Album";
    let secondaryTypes: string[] = [];
    if (detail.albumType === "single") {
      primaryType = "Single";
    } else if (detail.albumType === "compilation") {
      primaryType = "Album";
      secondaryTypes = ["Compilation"];
    }

    const inserted = await db
      .insert(albums)
      .values({
        id,
        mbid: null,
        title: detail.title,
        artistName: detail.artistName,
        artistMbid: null,
        artistSpotifyId: detail.artistSpotifyId,
        releaseDate: detail.releaseDate,
        year: detail.year,
        primaryType,
        secondaryTypes,
        genres: detail.genres,
        trackCount: detail.trackCount,
        primaryReleaseId: null,
        tracks: detail.tracks,
        externalUrls: detail.spotifyUrl ? { spotify: detail.spotifyUrl } : {},
        coverArtUrl: detail.artworkUrl,
      })
      .onConflictDoUpdate({
        target: albums.id,
        set: {
          title: detail.title,
          artistName: detail.artistName,
          coverArtUrl: detail.artworkUrl,
        },
      })
      .returning()
      .get();

    return inserted ?? null;
  }

  // Default: MusicBrainz MBID
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
      primaryReleaseId: detail.primaryReleaseId,
      externalUrls: detail.externalUrls,
    })
    .onConflictDoUpdate({
      target: albums.id,
      set: { title: detail.title, artistName: detail.artistName },
    })
    .returning()
    .get();

  return inserted ?? null;
});

/**
 * Track count, fetched on demand and cached on the album row.
 *
 * Kept out of the initial album load deliberately: it needs a second request to
 * MusicBrainz, and the one-per-second rate limit means asking for it up front
 * delays the entire page by more than a second. The album page renders first
 * and streams this in behind it.
 */
export interface AlbumTracklist {
  tracks: Track[];
  count: number | null;
}

export async function getTracklist(id: string): Promise<AlbumTracklist> {
  const album = await getAlbum(id);
  if (!album) return { tracks: [], count: null };

  // A stored array — even an empty one — means the question has been asked.
  // Null means it never has: either the album predates the tracklist being
  // kept at all, or nothing has looked yet.
  if (album.tracks !== null) {
    return { tracks: album.tracks, count: album.trackCount };
  }

  if (!album.primaryReleaseId) return { tracks: [], count: album.trackCount };

  const { tracklist, links } = await fetchRelease(album.primaryReleaseId);

  await db
    .update(albums)
    .set({
      trackCount: tracklist?.count ?? album.trackCount ?? null,
      // Store [] rather than null on a miss, so this is asked once and no more.
      tracks: tracklist?.tracks ?? [],
      trackCountCheckedAt: new Date(),
      // The same response carries links the release group may not have had.
      externalUrls: mergeLinks(album.externalUrls ?? {}, links),
    })
    .where(eq(albums.id, id));

  return {
    tracks: tracklist?.tracks ?? [],
    count: tracklist?.count ?? album.trackCount ?? null,
  };
}

/**
 * Where to hear an album, backfilled once for anything cached before links
 * were collected. Null means never asked; an empty object means asked and
 * MusicBrainz had nothing, which is not asked again.
 */
export async function getExternalLinks(id: string): Promise<ExternalLinks> {
  const album = await getAlbum(id);
  if (!album) return {};
  if (album.externalUrls !== null) return album.externalUrls;
  if (!album.mbid) return {};

  let links = await fetchExternalLinks(album.mbid);

  // Release groups carry fewer links than the releases under them. Only pay for
  // the release when the group gave us nothing — and that request is the one
  // the tracklist uses, so it is usually already cached.
  if (Object.keys(links).length === 0 && album.primaryReleaseId) {
    links = (await fetchRelease(album.primaryReleaseId)).links;
  }

  await db.update(albums).set({ externalUrls: links }).where(eq(albums.id, id));

  return links;
}

/** Just the number, for the album page's metadata line. */
export async function getTrackCount(id: string): Promise<number | null> {
  return (await getTracklist(id)).count;
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

export async function getOwnedFormats(albumId: string): Promise<string[]> {
  const user = await getCurrentUser();
  const row = await db
    .select()
    .from(collection)
    .where(and(eq(collection.userId, user.id), eq(collection.albumId, albumId)))
    .get();
  return row?.formats ?? [];
}

export async function getCollection(): Promise<{ album: Album; formats: string[] }[]> {
  const user = await getCurrentUser();
  const rows = await db
    .select({ album: albums, formats: collection.formats })
    .from(collection)
    .innerJoin(albums, eq(collection.albumId, albums.id))
    .where(eq(collection.userId, user.id))
    .orderBy(desc(collection.createdAt));
  return rows;
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

/**
 * Albums the user probably wants to hear next.
 *
 * Two sources, merged and deduplicated:
 *   1. Albums browsed recently (in the local cache within the last 14 days)
 *      but not yet logged — these are the ones the user looked at and didn't
 *      add yet, so they're clearly on the radar.
 *   2. Albums by the user's highest-rated artists that aren't in the library.
 *      Fetches artist discographies from MusicBrainz if the local cache doesn't
 *      have enough — those responses are cached for 7 days so after the first
 *      hit the page is fast.
 */
export interface HomeRecommendation extends AlbumSearchResult {
  coverArtUrl: string | null;
}

export async function getHomeRecommendations({
  limit = 12,
}: { limit?: number } = {}): Promise<HomeRecommendation[]> {
  const user = await getCurrentUser();

  const loggedRows = await db
    .select({ albumId: entries.albumId })
    .from(entries)
    .where(eq(entries.userId, user.id));
  const loggedIds = new Set(loggedRows.map(r => r.albumId));

  // 1. Albums browsed in the last 14 days, not yet logged.
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const recentlyBrowsed: HomeRecommendation[] = (await db
    .select()
    .from(albums)
    .where(and(eq(albums.primaryType, "Album"), gt(albums.cachedAt, twoWeeksAgo)))
    .orderBy(desc(albums.cachedAt))
    .limit(50))
    .filter(a => !loggedIds.has(a.id) && (a.secondaryTypes?.length ?? 0) === 0)
    .map(a => ({
      mbid: a.id,
      title: a.title,
      artistName: a.artistName,
      artistMbid: a.artistMbid,
      year: a.year,
      releaseDate: a.releaseDate,
      primaryType: a.primaryType,
      secondaryTypes: a.secondaryTypes ?? [],
      score: 0,
      coverArtUrl: a.coverArtUrl ?? null,
    }));

  if (recentlyBrowsed.length >= limit) return recentlyBrowsed.slice(0, limit);

  // 2. Albums by top-rated artists (avg ≥ 7 = 3.5 stars), fetched from MB.
  const topArtists = await db
    .select({ artistMbid: albums.artistMbid })
    .from(entries)
    .innerJoin(albums, eq(entries.albumId, albums.id))
    .where(and(
      eq(entries.userId, user.id),
      isNotNull(entries.rating),
      isNotNull(albums.artistMbid),
    ))
    .groupBy(albums.artistMbid)
    .having(sql`avg(${entries.rating}) >= 7`)
    .orderBy(desc(sql`avg(${entries.rating})`))
    .limit(3);

  const recs: HomeRecommendation[] = [...recentlyBrowsed];
  const seenMbids = new Set(recs.map(r => r.mbid));

  for (const { artistMbid } of topArtists) {
    if (!artistMbid || recs.length >= limit) break;
    try {
      const { releaseGroups } = await getArtistReleaseGroups(artistMbid);
      for (const rg of releaseGroups) {
        if (recs.length >= limit) break;
        if (
          rg.primaryType === "Album" &&
          rg.secondaryTypes.length === 0 &&
          !loggedIds.has(rg.mbid) &&
          !seenMbids.has(rg.mbid)
        ) {
          recs.push({ ...rg, coverArtUrl: null });
          seenMbids.add(rg.mbid);
        }
      }
    } catch {
      // Skip artists if MB is unavailable
    }
  }

  return recs.slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* Social / profiles                                                           */
/* -------------------------------------------------------------------------- */

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

export async function getUserByUsername(username: string): Promise<PublicUser | null> {
  await ready();
  const user = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      bio: schema.users.bio,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  return user ?? null;
}

export interface ProfileStats {
  logged: number;
  rated: number;
  followers: number;
  following: number;
}

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  await ready();
  const [totals, followerRow, followingRow] = await Promise.all([
    db
      .select({
        logged: count(),
        rated: sql<number>`sum(case when ${entries.rating} is not null then 1 else 0 end)`,
      })
      .from(entries)
      .where(eq(entries.userId, userId))
      .get(),
    db.select({ n: count() }).from(follows).where(eq(follows.followingId, userId)).get(),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, userId)).get(),
  ]);
  return {
    logged: totals?.logged ?? 0,
    rated: Number(totals?.rated ?? 0),
    followers: followerRow?.n ?? 0,
    following: followingRow?.n ?? 0,
  };
}

export async function getProfileEntries(
  userId: string,
  { limit = 12 }: { limit?: number } = {},
): Promise<EntryWithAlbum[]> {
  return db
    .select({ entry: entries, album: albums })
    .from(entries)
    .innerJoin(albums, eq(entries.albumId, albums.id))
    .where(eq(entries.userId, userId))
    .orderBy(desc(entries.updatedAt))
    .limit(limit);
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  await ready();
  const row = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .get();
  return Boolean(row);
}

export async function searchUsers(query: string): Promise<PublicUser[]> {
  const q = query.trim();
  if (!q) return [];
  return db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      bio: schema.users.bio,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.users)
    .where(like(schema.users.username, `%${q}%`))
    .limit(20);
}
