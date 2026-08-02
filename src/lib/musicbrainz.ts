/**
 * Minimal MusicBrainz web-service client.
 *
 * Two rules the API enforces and will block you for ignoring:
 *   1. A descriptive User-Agent with contact details.
 *   2. No more than one request per second, per IP.
 * Both are handled here so callers never have to think about them.
 */

const MB_BASE = "https://musicbrainz.org/ws/2";

const CONTACT =
  process.env.MUSICBRAINZ_CONTACT ?? "https://github.com/jimbo8e6/Music";
const USER_AGENT = `Wax/0.1.0 ( ${CONTACT} )`;

/** MusicBrainz allows 1 req/s; 1100ms leaves room for clock jitter. */
const MIN_INTERVAL_MS = 1100;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

/** Serialises every outbound call and spaces them out to respect the limit. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return task();
  });

  // Keep the chain alive even when one call rejects.
  queue = run.catch(() => undefined);
  return run;
}

export class MusicBrainzError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MusicBrainzError";
  }
}

async function mbFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${MB_BASE}${path}`);
  url.searchParams.set("fmt", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  return schedule(async () => {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      // Upstream data barely moves; our own DB is the real cache.
      next: { revalidate: 60 * 60 * 24 },
    });

    if (res.status === 404) {
      throw new MusicBrainzError(`Not found: ${path}`, 404);
    }
    if (res.status === 503) {
      throw new MusicBrainzError(
        "MusicBrainz is rate-limiting us — try again in a moment.",
        503,
      );
    }
    if (!res.ok) {
      throw new MusicBrainzError(
        `MusicBrainz responded ${res.status}`,
        res.status,
      );
    }

    return (await res.json()) as T;
  });
}

/** Escapes Lucene syntax so a user typing `AC/DC` or `10:15` doesn't 400. */
function escapeLucene(input: string): string {
  return input.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

export interface AlbumSearchResult {
  mbid: string;
  title: string;
  artistName: string;
  artistMbid: string | null;
  year: number | null;
  releaseDate: string | null;
  primaryType: string | null;
  secondaryTypes: string[];
  /** MusicBrainz search relevance, 0–100. */
  score: number;
}

interface MBArtistCredit {
  name?: string;
  joinphrase?: string;
  artist?: { id?: string; name?: string };
}

interface MBReleaseGroup {
  id: string;
  title: string;
  "first-release-date"?: string;
  "primary-type"?: string | null;
  "secondary-types"?: string[];
  "artist-credit"?: MBArtistCredit[];
  genres?: { name: string; count: number }[];
  releases?: { id: string; title?: string }[];
  score?: number;
}

/** Renders "Artist feat. Other" the way MusicBrainz intends it to read. */
function creditToString(credits: MBArtistCredit[] | undefined): string {
  if (!credits?.length) return "Unknown artist";
  return credits
    .map((c) => `${c.name ?? c.artist?.name ?? ""}${c.joinphrase ?? ""}`)
    .join("")
    .trim();
}

function yearOf(date: string | undefined): number | null {
  if (!date) return null;
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function toSearchResult(rg: MBReleaseGroup): AlbumSearchResult {
  return {
    mbid: rg.id,
    title: rg.title,
    artistName: creditToString(rg["artist-credit"]),
    artistMbid: rg["artist-credit"]?.[0]?.artist?.id ?? null,
    releaseDate: rg["first-release-date"] ?? null,
    year: yearOf(rg["first-release-date"]),
    primaryType: rg["primary-type"] ?? null,
    secondaryTypes: rg["secondary-types"] ?? [],
    score: rg.score ?? 0,
  };
}

export interface SearchOptions {
  limit?: number;
  /** Restrict to these MusicBrainz primary types. Empty array means no filter. */
  types?: string[];
}

/**
 * Free-text album search. Defaults to albums and EPs, which is what people mean
 * when they say "album" — singles and broadcasts just add noise.
 */
export async function searchAlbums(
  query: string,
  { limit = 24, types = ["album", "ep"] }: SearchOptions = {},
): Promise<AlbumSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const clauses = [`(${escapeLucene(trimmed)})`];
  if (types.length) {
    clauses.push(`primarytype:(${types.join(" OR ")})`);
  }

  const data = await mbFetch<{ "release-groups"?: MBReleaseGroup[] }>(
    "/release-group",
    { query: clauses.join(" AND "), limit: String(limit) },
  );

  const groups = data["release-groups"] ?? [];

  // MusicBrainz happily returns the same album as several release-groups when
  // reissues were modelled separately; collapse on title+artist, keep the best.
  const seen = new Map<string, AlbumSearchResult>();
  for (const rg of groups) {
    const result = toSearchResult(rg);
    const key = `${result.title.toLowerCase()}::${result.artistName.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || result.score > existing.score) seen.set(key, result);
  }

  return [...seen.values()].sort((a, b) => b.score - a.score);
}

export interface AlbumDetail extends AlbumSearchResult {
  genres: string[];
  trackCount: number | null;
}

/** Full detail for one release-group, including a representative tracklist size. */
export async function lookupAlbum(mbid: string): Promise<AlbumDetail> {
  const rg = await mbFetch<MBReleaseGroup>(`/release-group/${mbid}`, {
    inc: "artist-credits+releases+genres",
  });

  const base = toSearchResult(rg);
  const genres = (rg.genres ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((g) => g.name);

  return { ...base, genres, trackCount: await trackCountFor(rg) };
}

/**
 * Release-groups don't carry a tracklist, so we look at the first release under
 * the group. Best-effort: a missing count is not worth failing the page over.
 */
async function trackCountFor(rg: MBReleaseGroup): Promise<number | null> {
  const releaseId = rg.releases?.[0]?.id;
  if (!releaseId) return null;

  try {
    const release = await mbFetch<{ media?: { "track-count"?: number }[] }>(
      `/release/${releaseId}`,
      { inc: "recordings" },
    );
    const total = (release.media ?? []).reduce(
      (sum, medium) => sum + (medium["track-count"] ?? 0),
      0,
    );
    return total || null;
  } catch {
    return null;
  }
}
