"use server";

import { readCache, writeCache } from "@/lib/mbCache";

const BASE = "https://ws.audioscrobbler.com/2.0";
const CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface LastFmAlbum {
  name: string;
  artistName: string;
  mbid: string | null;
  artistMbid: string | null;
  imageUrl: string | null;
}

interface RawImage { "#text": string; size: string }

function bestImage(images: RawImage[]): string | null {
  for (const size of ["extralarge", "large", "medium"]) {
    const url = images.find(i => i.size === size)?.["#text"];
    if (url) return url;
  }
  return null;
}

function apiKey(): string {
  const key = process.env.LASTFM_API_KEY?.trim();
  if (!key) throw new Error("LASTFM_API_KEY environment variable is not set.");
  return key;
}

/** Generic cached Last.fm API call. Cache key excludes the API key. */
async function callApi(params: Record<string, string>, cacheMs = CACHE_MS): Promise<unknown> {
  const cacheKey = `lastfm:${new URLSearchParams(params).toString()}`;
  const cached = await readCache(cacheKey, cacheMs);
  if (cached !== null) return cached;

  const url = new URL(`${BASE}/`);
  url.searchParams.set("api_key", apiKey());
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { headers: { "User-Agent": "Wax/1.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json() as unknown;
  const maybeErr = data as { error?: number; message?: string };
  if (maybeErr.error) throw new Error(`Last.fm error ${maybeErr.error}: ${maybeErr.message}`);

  await writeCache(cacheKey, data);
  return data;
}

/**
 * Returns popular albums by fetching the top artists chart, then getting
 * each artist's #1 album in parallel. chart.getTopAlbums does not exist
 * in Last.fm's API — this two-step approach is the correct alternative.
 */
export async function getTopAlbums({ limit = 10 }: { limit?: number } = {}): Promise<LastFmAlbum[]> {
  const artistsData = await callApi({ method: "chart.getTopArtists", limit: String(limit) });
  const artists = ((artistsData as { artists?: { artist?: { name: string; mbid?: string }[] } })
    .artists?.artist ?? []);

  const results = await Promise.all(
    artists.map(async (artist) => {
      try {
        const data = await callApi({ method: "artist.getTopAlbums", artist: artist.name, limit: "1" });
        const album = ((data as { topalbums?: { album?: { name: string; mbid?: string; image: RawImage[] }[] } })
          .topalbums?.album ?? [])[0];
        if (!album?.name || album.name === "(null)") return null;
        return {
          name: album.name,
          artistName: artist.name,
          mbid: album.mbid || null,
          artistMbid: artist.mbid || null,
          imageUrl: bestImage(album.image),
        } satisfies LastFmAlbum;
      } catch {
        return null;
      }
    }),
  );

  return results.filter((a): a is LastFmAlbum => a !== null);
}

export interface LastFmSimilarArtist {
  name: string;
  mbid: string | null;
  match: number;
}

export async function getSimilarArtists(
  { mbid, name }: { mbid?: string; name?: string },
  { limit = 5 }: { limit?: number } = {},
): Promise<LastFmSimilarArtist[]> {
  if (!mbid && !name) return [];
  const params: Record<string, string> = { method: "artist.getSimilar", limit: String(limit) };
  if (mbid) params.mbid = mbid;
  else params.artist = name!;
  const data = await callApi(params);
  const artists = (
    data as { similarartists?: { artist?: { name: string; mbid?: string; match?: string }[] } }
  ).similarartists?.artist ?? [];
  return artists.map((a) => ({
    name: a.name,
    mbid: a.mbid || null,
    match: parseFloat(a.match ?? "0"),
  }));
}

export async function checkLastFmHealth(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const data = await callApi({ method: "chart.getTopArtists", limit: "4" }, 0);
    const count = ((data as { artists?: { artist?: unknown[] } }).artists?.artist ?? []).length;
    return { ok: count > 0, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
