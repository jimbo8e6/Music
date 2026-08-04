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
  playcount: number;
}

interface RawImage { "#text": string; size: string }
interface RawAlbum {
  name: string;
  playcount: string;
  mbid?: string;
  url: string;
  artist: { name: string; mbid?: string };
  image: RawImage[];
}

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

function parse(data: unknown): LastFmAlbum[] {
  const raw = data as { albums?: { album?: RawAlbum[] } };
  return (raw.albums?.album ?? []).map(a => ({
    name: a.name,
    artistName: a.artist.name,
    mbid: a.mbid || null,
    artistMbid: a.artist.mbid || null,
    imageUrl: bestImage(a.image),
    playcount: parseInt(a.playcount, 10) || 0,
  }));
}

async function fetchTopAlbums(limit: number): Promise<unknown> {
  const url = `${BASE}/?method=chart.getTopAlbums&api_key=${apiKey()}&format=json&limit=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": "Wax/1.0" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as unknown;
  // Last.fm returns errors as { error: number, message: string } with HTTP 200
  const maybeErr = data as { error?: number; message?: string };
  if (maybeErr.error) throw new Error(`Last.fm error ${maybeErr.error}: ${maybeErr.message}`);
  return data;
}

export async function getTopAlbums({ limit = 10 }: { limit?: number } = {}): Promise<LastFmAlbum[]> {
  const cacheKey = `lastfm:chart.getTopAlbums:limit=${limit}`;
  const cached = await readCache(cacheKey, CACHE_MS);
  if (cached !== null) return parse(cached);

  try {
    const data = await fetchTopAlbums(limit);
    await writeCache(cacheKey, data);
    return parse(data);
  } catch (err) {
    console.error("[lastfm] getTopAlbums failed:", err);
    return [];
  }
}

export async function checkLastFmHealth(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const data = await fetchTopAlbums(4);
    const count = parse(data).length;
    return { ok: count > 0, count };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
