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

export async function getTopAlbums({ limit = 10 }: { limit?: number } = {}): Promise<LastFmAlbum[]> {
  // Cache key intentionally omits the API key value.
  const cacheKey = `lastfm:chart.getTopAlbums:limit=${limit}`;
  const cached = await readCache(cacheKey, CACHE_MS);
  if (cached !== null) return parse(cached);

  try {
    const url = `${BASE}/?method=chart.getTopAlbums&api_key=${apiKey()}&format=json&limit=${limit}`;
    const res = await fetch(url, { headers: { "User-Agent": "Wax/1.0" }, cache: "no-store" });
    if (!res.ok) {
      console.error(`[lastfm] HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    await writeCache(cacheKey, data);
    return parse(data);
  } catch (err) {
    console.error("[lastfm] getTopAlbums failed:", err);
    return [];
  }
}
