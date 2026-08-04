/**
 * Spotify Web API client — Client Credentials flow (no user auth required).
 *
 * Tokens last 3600 s; we cache them with a 55-minute TTL so expiry is never
 * a surprise mid-request. Every other response is stored in mb_cache with a
 * longer TTL so cold starts and network outages return stale-but-useful data.
 *
 * Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env.local.
 */

import { readCache, writeCache } from "@/lib/mbCache";

const SPOTIFY_BASE = "https://api.spotify.com/v1";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const TOKEN_CACHE_KEY = "spotify:token:v1";
const TOKEN_TTL_MS = 55 * 60 * 1000;
const SEARCH_CACHE_MS = 12 * 60 * 60 * 1000;
const LOOKUP_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export class SpotifyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "SpotifyError";
  }
}

async function getToken(): Promise<string> {
  const cached = await readCache(TOKEN_CACHE_KEY, TOKEN_TTL_MS);
  if (cached !== null) {
    const token = (cached as { access_token?: string }).access_token;
    if (token) return token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new SpotifyError(
      "Spotify credentials missing — add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env.local",
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SpotifyError(
      `Spotify auth failed: HTTP ${res.status}${body ? ` — ${body}` : ""}`,
      res.status,
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  if (!data.access_token) {
    throw new SpotifyError("Spotify token response missing access_token");
  }
  await writeCache(TOKEN_CACHE_KEY, data);
  return data.access_token;
}

async function spotifyFetch<T>(
  path: string,
  params: Record<string, string> = {},
  cacheMs = SEARCH_CACHE_MS,
): Promise<T> {
  const url = new URL(`${SPOTIFY_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const cacheKey = url.toString();
  const cached = await readCache(cacheKey, cacheMs);
  if (cached !== null) return cached as T;

  const token = await getToken();
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  if (res.status === 404) throw new SpotifyError("Not found on Spotify", 404);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SpotifyError(`Spotify responded ${res.status}${body ? ` — ${body}` : ""}`, res.status);
  }

  const data = (await res.json()) as T;
  await writeCache(cacheKey, data);
  return data;
}

/* -------------------------------------------------------------------------- */
/* Shared types                                                                */
/* -------------------------------------------------------------------------- */

/** Best image from Spotify's array, largest first. */
function bestImage(
  images: { url: string; width: number | null; height: number | null }[] | undefined,
): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

function yearOf(date: string | undefined | null): number | null {
  if (!date) return null;
  const y = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(y) ? null : y;
}

/* -------------------------------------------------------------------------- */
/* New releases (via editorial playlist)                                       */
/* -------------------------------------------------------------------------- */

// Spotify's "New Music Friday" (US). Spotify maintains this weekly.
const NEW_MUSIC_FRIDAY_ID = "37i9dQZF1DX4JAvHpjipBk";

interface RawPlaylistTrackPage {
  items: Array<{ track: { album: RawSpotifyAlbum } | null } | null>;
}

/**
 * Returns up to `limit` distinct albums from Spotify's New Music Friday
 * playlist. Falls back to an empty array on any error.
 */
export async function getSpotifyNewReleases(limit = 10): Promise<SpotifyAlbumResult[]> {
  try {
    const data = await spotifyFetch<RawPlaylistTrackPage>(
      `/playlists/${NEW_MUSIC_FRIDAY_ID}/tracks`,
      { limit: "50" },
      6 * 60 * 60 * 1000,
    );
    const seen = new Set<string>();
    const albums: SpotifyAlbumResult[] = [];
    for (const item of data?.items ?? []) {
      const album = item?.track?.album;
      if (!album?.id || seen.has(album.id)) continue;
      seen.add(album.id);
      albums.push(toAlbumResult(album));
      if (albums.length >= limit) break;
    }
    return albums;
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Album search                                                                */
/* -------------------------------------------------------------------------- */

export interface SpotifyAlbumResult {
  spotifyId: string;
  title: string;
  artistName: string;
  artistSpotifyId: string;
  year: number | null;
  releaseDate: string | null;
  artworkUrl: string | null;
  /** "album" | "single" | "compilation" */
  albumType: string;
  totalTracks: number;
}

interface RawSpotifyAlbum {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: { url: string; width: number | null; height: number | null }[];
  release_date: string;
  album_type: string;
  total_tracks: number;
}

function toAlbumResult(album: RawSpotifyAlbum): SpotifyAlbumResult {
  return {
    spotifyId: album.id,
    title: album.name,
    artistName: album.artists.map(a => a.name).join(", "),
    artistSpotifyId: album.artists[0]?.id ?? "",
    year: yearOf(album.release_date),
    releaseDate: album.release_date ?? null,
    artworkUrl: bestImage(album.images),
    albumType: album.album_type,
    totalTracks: album.total_tracks,
  };
}

export async function searchSpotifyAlbums(
  query: string,
  _options: { limit?: number } = {},
): Promise<SpotifyAlbumResult[]> {
  if (!query.trim()) return [];
  const data = await spotifyFetch<{ albums: { items: RawSpotifyAlbum[] } }>(
    "/search",
    { q: query.trim(), type: "album" },
  );
  return (data.albums?.items ?? []).map(toAlbumResult);
}

/* -------------------------------------------------------------------------- */
/* Artist search                                                               */
/* -------------------------------------------------------------------------- */

export interface SpotifyArtistResult {
  spotifyId: string;
  name: string;
  genres: string[];
  artworkUrl: string | null;
  popularity: number;
  followerCount: number;
  spotifyUrl: string | null;
}

interface RawSpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; width: number | null; height: number | null }[];
  popularity: number;
  followers: { total: number };
  external_urls: { spotify?: string };
}

function toArtistResult(artist: RawSpotifyArtist): SpotifyArtistResult {
  return {
    spotifyId: artist.id,
    name: artist.name,
    genres: artist.genres ?? [],
    artworkUrl: bestImage(artist.images),
    popularity: artist.popularity ?? 0,
    followerCount: artist.followers?.total ?? 0,
    spotifyUrl: artist.external_urls?.spotify ?? null,
  };
}

export async function searchSpotifyArtists(
  query: string,
  _options: { limit?: number } = {},
): Promise<SpotifyArtistResult[]> {
  if (!query.trim()) return [];
  const data = await spotifyFetch<{ artists: { items: RawSpotifyArtist[] } }>(
    "/search",
    { q: query.trim(), type: "artist" },
  );
  return (data.artists?.items ?? []).map(toArtistResult);
}

/* -------------------------------------------------------------------------- */
/* Album detail                                                                */
/* -------------------------------------------------------------------------- */

export interface SpotifyTrack {
  position: number;
  title: string;
  lengthMs: number | null;
  medium: number;
}

export interface SpotifyAlbumDetail extends SpotifyAlbumResult {
  genres: string[];
  tracks: SpotifyTrack[];
  trackCount: number;
  spotifyUrl: string | null;
  allArtistIds: string[];
}

interface RawSpotifyAlbumDetail extends RawSpotifyAlbum {
  genres: string[];
  label: string;
  tracks: {
    items: {
      id: string;
      name: string;
      track_number: number;
      disc_number: number;
      duration_ms: number;
    }[];
    total: number;
  };
  external_urls: { spotify?: string };
}

export async function getSpotifyAlbum(id: string): Promise<SpotifyAlbumDetail> {
  const album = await spotifyFetch<RawSpotifyAlbumDetail>(
    `/albums/${id}`,
    {},
    LOOKUP_CACHE_MS,
  );

  const tracks: SpotifyTrack[] = (album.tracks?.items ?? []).map(t => ({
    position: t.track_number,
    title: t.name,
    lengthMs: t.duration_ms > 0 ? t.duration_ms : null,
    medium: t.disc_number ?? 1,
  }));

  return {
    ...toAlbumResult(album),
    genres: album.genres ?? [],
    tracks,
    trackCount: album.tracks?.total ?? tracks.length,
    spotifyUrl: album.external_urls?.spotify ?? null,
    allArtistIds: album.artists.map(a => a.id),
  };
}

/* -------------------------------------------------------------------------- */
/* Artist detail + discography                                                 */
/* -------------------------------------------------------------------------- */

export interface SpotifyArtistDetail extends SpotifyArtistResult {
  disambiguation: null;
}

export async function getSpotifyArtist(id: string): Promise<SpotifyArtistDetail> {
  const artist = await spotifyFetch<RawSpotifyArtist>(
    `/artists/${id}`,
    {},
    LOOKUP_CACHE_MS,
  );
  return { ...toArtistResult(artist), disambiguation: null };
}

export async function getSpotifyArtistAlbums(
  artistId: string,
  {
    includeGroups = "album,single,compilation",
  }: { includeGroups?: string } = {},
): Promise<SpotifyAlbumResult[]> {
  const all: SpotifyAlbumResult[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (;;) {
    const params: Record<string, string> = {
      include_groups: includeGroups,
      market: "US",
    };
    if (offset > 0) params.offset = String(offset);

    let page: { items: RawSpotifyAlbum[]; total: number; next: string | null };
    try {
      page = await spotifyFetch<typeof page>(
        `/artists/${artistId}/albums`,
        params,
        LOOKUP_CACHE_MS,
      );
    } catch (err) {
      if (all.length > 0) break;
      console.error("[spotify] Artist albums fetch failed:", err);
      return [];
    }

    for (const album of page.items ?? []) {
      if (!seen.has(album.id)) {
        seen.add(album.id);
        all.push(toAlbumResult(album));
      }
    }

    if (!page.next || !page.items?.length || all.length >= 300) break;
    offset += page.items.length;
  }

  return all;
}

/* -------------------------------------------------------------------------- */
/* ID helpers                                                                  */
/* -------------------------------------------------------------------------- */

/** Spotify IDs are 22-character base-62 strings. */
export function isSpotifyId(id: string): boolean {
  return /^[A-Za-z0-9]{22}$/.test(id);
}
