import { cache } from "react";

import { and, avg, count, desc, eq, isNotNull, like, or, sql } from "drizzle-orm";

import { db, getCurrentUser, getOptionalCurrentUser, ready, schema } from "@/db";
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
import { getSimilarArtists } from "@/lib/lastfm";
import { getDeezerArtistAlbums } from "@/lib/deezer";
import { getDeezerAlbum, isDeezerAlbumId } from "@/lib/deezer";
import { getSpotifyAlbum, isSpotifyId } from "@/lib/spotify";

export interface EntryWithAlbum {
  entry: Entry;
  album: Album;
}

const { albums, entries, watchlist, collection, follows, favourites } = schema;

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

  // Deezer IDs (numeric strings): fetch from Deezer
  if (isDeezerAlbumId(id)) {
    const detail = await getDeezerAlbum(id);

    let primaryType = "Album";
    let secondaryTypes: string[] = [];
    if (detail.albumType === "single" || detail.albumType === "ep") {
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
        artistSpotifyId: detail.artistDeezerId,
        releaseDate: detail.releaseDate,
        year: detail.year,
        primaryType,
        secondaryTypes,
        genres: detail.genres,
        trackCount: detail.trackCount,
        primaryReleaseId: null,
        tracks: detail.tracks,
        externalUrls: detail.deezerUrl ? { deezer: detail.deezerUrl } : {},
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
  await ready();
  return db.select().from(albums).where(eq(albums.id, id)).get();
}

export async function getEntryForAlbum(albumId: string): Promise<Entry | undefined> {
  const user = await getOptionalCurrentUser();
  if (!user) return undefined;
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
  const user = await getOptionalCurrentUser();
  if (!user) return [];
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

export async function getProfileCollection(userId: string): Promise<{ album: Album; formats: string[] }[]> {
  await ready();
  return db
    .select({ album: albums, formats: collection.formats })
    .from(collection)
    .innerJoin(albums, eq(collection.albumId, albums.id))
    .where(eq(collection.userId, userId))
    .orderBy(desc(collection.createdAt));
}

export async function isOnWatchlist(albumId: string): Promise<boolean> {
  const user = await getOptionalCurrentUser();
  if (!user) return false;
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
 * Shows albums by the user's highest-rated artists that aren't already in
 * their library. Fetches artist discographies from MusicBrainz; responses
 * are cached for 7 days so after the first hit the page is fast.
 */
export interface HomeRecommendation extends AlbumSearchResult {
  coverArtUrl: string | null;
}

export async function getHomeRecommendations({
  limit = 12,
}: { limit?: number } = {}): Promise<HomeRecommendation[]> {
  const user = await getOptionalCurrentUser();
  if (!user) return [];

  const loggedRows = await db
    .select({ albumId: entries.albumId })
    .from(entries)
    .where(eq(entries.userId, user.id));
  const loggedIds = new Set(loggedRows.map(r => r.albumId));

  // Group by artistName so both MusicBrainz and Deezer albums qualify.
  const topArtists = await db
    .select({
      artistName: albums.artistName,
      artistMbid: albums.artistMbid,
      artistDeezerId: albums.artistSpotifyId,
    })
    .from(entries)
    .innerJoin(albums, eq(entries.albumId, albums.id))
    .where(and(
      eq(entries.userId, user.id),
      isNotNull(entries.rating),
      or(isNotNull(albums.artistMbid), isNotNull(albums.artistSpotifyId)),
    ))
    .groupBy(albums.artistName)
    .having(sql`avg(${entries.rating}) >= 7`)
    .orderBy(desc(sql`avg(${entries.rating})`))
    .limit(3);

  const recs: HomeRecommendation[] = [];
  const seenIds = new Set<string>();
  const topArtistMbids = new Set(topArtists.map(a => a.artistMbid).filter(Boolean) as string[]);

  // Source 1: unlogged studio albums by the user's own top-rated artists.
  for (const { artistMbid, artistDeezerId, artistName } of topArtists) {
    if (recs.length >= limit) break;
    try {
      if (artistMbid) {
        const { releaseGroups } = await getArtistReleaseGroups(artistMbid);
        for (const rg of releaseGroups) {
          if (recs.length >= limit) break;
          if (
            rg.primaryType === "Album" &&
            rg.secondaryTypes.length === 0 &&
            !loggedIds.has(rg.mbid) &&
            !seenIds.has(rg.mbid)
          ) {
            recs.push({ ...rg, coverArtUrl: null });
            seenIds.add(rg.mbid);
          }
        }
      } else if (artistDeezerId && isDeezerAlbumId(artistDeezerId)) {
        const deezerAlbums = await getDeezerArtistAlbums(artistDeezerId, artistName ?? undefined);
        for (const a of deezerAlbums) {
          if (recs.length >= limit) break;
          if (
            a.albumType === "album" &&
            !loggedIds.has(a.deezerId) &&
            !seenIds.has(a.deezerId)
          ) {
            recs.push({
              mbid: a.deezerId,
              title: a.title,
              artistName: a.artistName,
              artistMbid: null,
              year: a.year,
              releaseDate: a.releaseDate,
              primaryType: "Album",
              secondaryTypes: [],
              score: 0,
              coverArtUrl: a.artworkUrl,
            });
            seenIds.add(a.deezerId);
          }
        }
      }
    } catch {
      // Skip if API is unavailable
    }
  }

  // Source 2: albums by similar artists (via Last.fm), to fill remaining slots.
  if (recs.length < limit) {
    for (const { artistMbid, artistName } of topArtists) {
      if (recs.length >= limit) break;
      try {
        const similar = await getSimilarArtists(
          artistMbid ? { mbid: artistMbid } : { name: artistName ?? undefined },
          { limit: 5 },
        );
        for (const sim of similar) {
          if (!sim.mbid || recs.length >= limit) continue;
          if (topArtistMbids.has(sim.mbid)) continue;
          try {
            const { releaseGroups } = await getArtistReleaseGroups(sim.mbid);
            for (const rg of releaseGroups) {
              if (recs.length >= limit) break;
              if (
                rg.primaryType === "Album" &&
                rg.secondaryTypes.length === 0 &&
                !loggedIds.has(rg.mbid) &&
                !seenIds.has(rg.mbid)
              ) {
                recs.push({ ...rg, coverArtUrl: null });
                seenIds.add(rg.mbid);
              }
            }
          } catch {
            // Skip if MB is unavailable for this similar artist
          }
        }
      } catch {
        // Skip if Last.fm is unavailable
      }
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

export async function getFavouriteAlbums(userId: string): Promise<(Album | null)[]> {
  await ready();
  const rows = await db
    .select({ album: albums, position: favourites.position })
    .from(favourites)
    .innerJoin(albums, eq(favourites.albumId, albums.id))
    .where(eq(favourites.userId, userId));

  const result: (Album | null)[] = [null, null, null, null];
  for (const { album, position } of rows) {
    if (position >= 1 && position <= 4) result[position - 1] = album;
  }
  return result;
}

export async function getFollowers(userId: string): Promise<PublicUser[]> {
  await ready();
  return db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      bio: schema.users.bio,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(follows)
    .innerJoin(schema.users, eq(follows.followerId, schema.users.id))
    .where(eq(follows.followingId, userId))
    .orderBy(desc(follows.createdAt));
}

export async function getFollowing(userId: string): Promise<PublicUser[]> {
  await ready();
  return db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      bio: schema.users.bio,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(follows)
    .innerJoin(schema.users, eq(follows.followingId, schema.users.id))
    .where(eq(follows.followerId, userId))
    .orderBy(desc(follows.createdAt));
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

export interface CommentRow {
  id: number;
  body: string;
  parentId: number | null;
  createdAt: Date;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ThreadedComment extends CommentRow {
  replies: CommentRow[];
}

export async function getEntryComments(entryId: number): Promise<ThreadedComment[]> {
  await ready();
  const { comments, users } = schema;
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      parentId: comments.parentId,
      createdAt: comments.createdAt,
      userId: comments.userId,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.entryId, entryId))
    .orderBy(comments.createdAt);

  const topLevel = rows.filter((r) => r.parentId === null);
  const replies = rows.filter((r) => r.parentId !== null);
  return topLevel.map((c) => ({
    ...c,
    replies: replies.filter((r) => r.parentId === c.id),
  }));
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
