/**
 * Apple Music public RSS feeds — no credentials required.
 *
 * Apple publishes editorial charts at applemarketingtools.com. The "new-music"
 * feed is what appears on the Apple Music home page: mainstream, curated, and
 * always accompanied by artwork.
 *
 * Responses are stored in mb_cache (6h TTL). This means:
 *   - Cold starts and environments where Apple's CDN is firewalled still return
 *     results from the previous successful fetch.
 *   - We don't burn the MusicBrainz rate limit on polling.
 */

import { readCache, writeCache } from "@/lib/mbCache";

export interface AppleRelease {
  id: string;
  name: string;
  artistName: string;
  /** 500×500 artwork from Apple's CDN. Null when the field was absent. */
  artworkUrl: string | null;
  releaseDate: string | null;
}

const CACHE_MS = 6 * 60 * 60 * 1000;

export async function fetchAppleNewReleases({
  country = "us",
  limit = 8,
}: { country?: string; limit?: number } = {}): Promise<AppleRelease[]> {
  const url = `https://rss.applemarketingtools.com/api/v2/${country}/music/new-music/${limit}/albums.json`;

  const cached = await readCache(url, CACHE_MS);
  if (cached !== null) return parseAppleResults(cached);

  try {
    const res = await fetch(url, {
      // Apple's marketing tools CDN expects a browser-like UA; a bare Node
      // request sometimes gets a 403 or an empty feed.
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      },
      // Don't use next.revalidate here — it can conflict with force-dynamic
      // routes in Next.js 15. mb_cache is our durability layer instead.
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`[apple-rss] HTTP ${res.status} fetching ${url}`);
      return [];
    }

    const data = await res.json();
    await writeCache(url, data);
    return parseAppleResults(data);
  } catch (err) {
    console.error("[apple-rss] Failed to fetch new releases:", err);
    return [];
  }
}

function parseAppleResults(data: unknown): AppleRelease[] {
  const raw = data as { feed?: { results?: unknown[] } };
  return (raw.feed?.results ?? [])
    .map(r => {
      const item = r as Record<string, string | undefined>;
      return {
        id: item.id ?? "",
        name: item.name ?? "",
        artistName: item.artistName ?? "",
        // Apple's thumb URLs support arbitrary sizes via size-segment substitution.
        artworkUrl: item.artworkUrl100?.replace(/\d+x\d+bb/, "500x500bb") ?? null,
        releaseDate: item.releaseDate ?? null,
      };
    })
    .filter(r => r.id && r.name);
}
