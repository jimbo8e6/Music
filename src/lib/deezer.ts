/**
 * Deezer API client — no authentication required for public read access.
 *
 * Rate limit: ~50 requests per 5 s per IP, far more generous than Spotify
 * development mode. Responses are stored in mb_cache.
 *
 * Deezer IDs are plain positive integers (e.g. "302127").
 */

import { readCache, writeCache } from "@/lib/mbCache";

const DEEZER_BASE = "https://api.deezer.com";
const SEARCH_CACHE_MS = 12 * 60 * 60 * 1000;
const LOOKUP_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export class DeezerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "DeezerError";
  }
}

async function deezerFetch<T>(
  path: string,
  params: Record<string, string> = {},
  cacheMs = SEARCH_CACHE_MS,
): Promise<T> {
  const url = new URL(`${DEEZER_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cacheKey = `deezer:${url.toString()}`;
  const cached = await readCache(cacheKey, cacheMs);
  if (cached !== null) return cached as T;

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new DeezerError(`Deezer responded ${res.status}`, res.status);
  }

  const data = (await res.json()) as unknown;

  // Deezer surfaces some errors as HTTP 200 with an error body
  const maybeErr = data as { error?: { type: string; message: string; code: number } };
  if (maybeErr.error) {
    const { code, message } = maybeErr.error;
    if (code === 800) throw new DeezerError("Not found on Deezer", 404);
    throw new DeezerError(`Deezer error ${code}: ${message}`);
  }

  await writeCache(cacheKey, data);
  return data as T;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deezer's placeholder cover URL has an empty md5 segment (double-slash).
 * Filter it out so the app shows its own fallback rather than a black square.
 */
function bestCover(album: RawDeezerAlbum): string | null {
  const candidates = [album.cover_xl, album.cover_big, album.cover_medium, album.cover];
  for (const url of candidates) {
    if (url && !url.includes("//images/")) return url;
  }
  return null;
}

function yearOf(date: string | undefined | null): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

/* -------------------------------------------------------------------------- */
/* Raw API types                                                               */
/* -------------------------------------------------------------------------- */

interface RawDeezerAlbum {
  id: number;
  title: string;
  /** Present in search results; absent in artist album listings (artist is implied). */
  artist?: { id: number; name: string };
  cover_xl?: string | null;
  cover_big?: string | null;
  cover_medium?: string | null;
  cover?: string | null;
  md5_image?: string;
  release_date: string;
  record_type: string;
  nb_tracks: number;
  link: string;
}

interface RawDeezerAlbumDetail extends RawDeezerAlbum {
  genres?: { data: { id: number; name: string }[] };
  tracks?: {
    data: {
      id: number;
      title: string;
      duration: number;
      track_position: number;
      disk_number: number;
    }[];
  };
}

interface RawDeezerArtist {
  id: number;
  name: string;
  picture_xl?: string | null;
  picture_big?: string | null;
  picture_medium?: string | null;
  picture?: string | null;
  nb_fan: number;
  link: string;
}

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export interface DeezerAlbumResult {
  deezerId: string;
  title: string;
  artistName: string;
  artistDeezerId: string;
  year: number | null;
  releaseDate: string | null;
  artworkUrl: string | null;
  /** "album" | "single" | "ep" | "compilation" */
  albumType: string;
  totalTracks: number;
}

export interface DeezerArtistResult {
  deezerId: string;
  name: string;
  genres: string[];
  artworkUrl: string | null;
  followerCount: number;
  deezerUrl: string | null;
}

export interface DeezerTrack {
  position: number;
  title: string;
  /** Deezer reports duration in seconds; stored here as milliseconds. */
  lengthMs: number | null;
  medium: number;
}

export interface DeezerAlbumDetail extends DeezerAlbumResult {
  genres: string[];
  tracks: DeezerTrack[];
  trackCount: number;
  deezerUrl: string | null;
}

export interface DeezerArtistDetail extends DeezerArtistResult {
  disambiguation: null;
}

/* -------------------------------------------------------------------------- */
/* Converters                                                                  */
/* -------------------------------------------------------------------------- */

function toAlbumResult(
  album: RawDeezerAlbum,
  fallbackArtist?: { id: string; name: string },
): DeezerAlbumResult {
  return {
    deezerId: String(album.id),
    title: album.title,
    artistName: album.artist?.name ?? fallbackArtist?.name ?? "",
    artistDeezerId: album.artist ? String(album.artist.id) : (fallbackArtist?.id ?? ""),
    year: yearOf(album.release_date),
    releaseDate: album.release_date ?? null,
    artworkUrl: bestCover(album),
    albumType: album.record_type ?? "album",
    totalTracks: album.nb_tracks,
  };
}

function toArtistResult(artist: RawDeezerArtist): DeezerArtistResult {
  return {
    deezerId: String(artist.id),
    name: artist.name,
    genres: [],
    artworkUrl: [artist.picture_xl, artist.picture_big, artist.picture_medium, artist.picture]
      .find(u => u && !u.includes("//images/")) ?? null,
    followerCount: artist.nb_fan ?? 0,
    deezerUrl: artist.link ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Album search                                                                */
/* -------------------------------------------------------------------------- */

export async function searchDeezerAlbums(
  query: string,
  { limit = 50 }: { limit?: number } = {},
): Promise<DeezerAlbumResult[]> {
  if (!query.trim()) return [];
  const data = await deezerFetch<{ data: RawDeezerAlbum[] }>(
    "/search/album",
    { q: query.trim(), limit: String(limit), strict: "on" },
  );
  return (data.data ?? [])
    .map((a) => toAlbumResult(a))
    .filter((a) => a.albumType !== "single");
}

/* -------------------------------------------------------------------------- */
/* Artist search                                                               */
/* -------------------------------------------------------------------------- */

export async function searchDeezerArtists(
  query: string,
  _options: { limit?: number } = {},
): Promise<DeezerArtistResult[]> {
  if (!query.trim()) return [];
  const data = await deezerFetch<{ data: RawDeezerArtist[] }>(
    "/search/artist",
    { q: query.trim(), limit: "20" },
  );
  return (data.data ?? []).map(toArtistResult);
}

/* -------------------------------------------------------------------------- */
/* Album detail                                                                */
/* -------------------------------------------------------------------------- */

export async function getDeezerAlbum(id: string): Promise<DeezerAlbumDetail> {
  const album = await deezerFetch<RawDeezerAlbumDetail>(
    `/album/${id}`,
    {},
    LOOKUP_CACHE_MS,
  );

  const tracks: DeezerTrack[] = (album.tracks?.data ?? []).map((t) => ({
    position: t.track_position,
    title: t.title,
    lengthMs: t.duration > 0 ? t.duration * 1000 : null,
    medium: t.disk_number ?? 1,
  }));

  return {
    ...toAlbumResult(album),
    genres: (album.genres?.data ?? []).map((g) => g.name),
    tracks,
    trackCount: album.nb_tracks,
    deezerUrl: album.link ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Artist detail + discography                                                 */
/* -------------------------------------------------------------------------- */

export async function getDeezerArtist(id: string): Promise<DeezerArtistDetail> {
  const artist = await deezerFetch<RawDeezerArtist>(
    `/artist/${id}`,
    {},
    LOOKUP_CACHE_MS,
  );
  return { ...toArtistResult(artist), disambiguation: null };
}

export async function getDeezerArtistAlbums(
  artistId: string,
  artistName?: string,
): Promise<DeezerAlbumResult[]> {
  const fallbackArtist = artistName ? { id: artistId, name: artistName } : undefined;
  const all: DeezerAlbumResult[] = [];
  const seen = new Set<string>();
  let index = 0;
  let grandTotal = Infinity;

  for (;;) {
    const params: Record<string, string> = { limit: "25" };
    if (index > 0) params.index = String(index);

    let page: { data: RawDeezerAlbum[]; total: number; next?: string };
    try {
      page = await deezerFetch<typeof page>(
        `/artist/${artistId}/albums`,
        params,
        LOOKUP_CACHE_MS,
      );
    } catch (err) {
      if (all.length > 0) break;
      throw err;
    }

    // Use the total from the first response as the authoritative page count.
    // Deezer sometimes omits `next` even when more pages exist, so checking
    // against total is more reliable than relying on the next field alone.
    if (grandTotal === Infinity) grandTotal = page.total ?? Infinity;

    for (const album of page.data ?? []) {
      const id = String(album.id);
      if (!seen.has(id)) {
        seen.add(id);
        all.push(toAlbumResult(album, fallbackArtist));
      }
    }

    if (!page.data?.length || all.length >= grandTotal || all.length >= 300) break;
    index += page.data.length;
  }

  return all;
}

/* -------------------------------------------------------------------------- */
/* Health check                                                                */
/* -------------------------------------------------------------------------- */

export async function checkDeezerHealth(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const data = await deezerFetch<{ data: RawDeezerAlbum[] }>(
      "/search/album",
      { q: "radiohead", limit: "5" },
      0,
    );
    const count = data.data?.length ?? 0;
    return { ok: count > 0, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/* -------------------------------------------------------------------------- */
/* ID helper                                                                   */
/* -------------------------------------------------------------------------- */

/** Deezer album and artist IDs are plain positive integers. */
export function isDeezerAlbumId(id: string): boolean {
  return /^\d+$/.test(id);
}
