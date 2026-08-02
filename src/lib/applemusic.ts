/**
 * Apple Music public RSS feeds — no credentials required.
 *
 * Apple publishes editorial charts at applemarketingtools.com. The "new-music"
 * feed is what appears on the Apple Music home page: mainstream, curated, and
 * always accompanied by artwork.
 */

export interface AppleRelease {
  id: string;
  name: string;
  artistName: string;
  /** 500×500 thumbnail from Apple's CDN. Null when the field was absent. */
  artworkUrl: string | null;
  releaseDate: string | null;
}

interface AppleRSSResult {
  id?: string;
  name?: string;
  artistName?: string;
  artworkUrl100?: string;
  releaseDate?: string;
}

export async function fetchAppleNewReleases({
  country = "us",
  limit = 8,
}: { country?: string; limit?: number } = {}): Promise<AppleRelease[]> {
  const url = `https://rss.applemarketingtools.com/api/v2/${country}/music/new-music/${limit}/albums.json`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // Apple's editorial lists refresh a few times a day at most.
      next: { revalidate: 6 * 60 * 60 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { feed?: { results?: AppleRSSResult[] } };

    return (data.feed?.results ?? [])
      .map(r => ({
        id: r.id ?? "",
        name: r.name ?? "",
        artistName: r.artistName ?? "",
        // Apple's image URLs support arbitrary sizes; swap the size segment.
        artworkUrl: r.artworkUrl100?.replace(/\d+x\d+bb/, "500x500bb") ?? null,
        releaseDate: r.releaseDate ?? null,
      }))
      .filter(r => r.id && r.name);
  } catch {
    return [];
  }
}
