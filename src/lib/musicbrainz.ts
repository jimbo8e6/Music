/**
 * Minimal MusicBrainz web-service client.
 *
 * Two rules the API enforces and will block you for ignoring:
 *   1. A descriptive User-Agent with contact details.
 *   2. No more than one request per second, per IP.
 * Both are handled here so callers never have to think about them.
 */

const MB_BASE = "https://musicbrainz.org/ws/2";

// MusicBrainz accepts a URL or an email here — it only needs a way to reach
// whoever is running the client. The repo URL is a valid contact on its own, so
// this default works with no configuration; override it in .env.local to be
// reachable more directly.
const CONTACT =
  process.env.MUSICBRAINZ_CONTACT ?? "https://github.com/jimbo8e6/music";
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

/** Inside a quoted phrase only the quote and the escape itself need escaping. */
function escapePhrase(input: string): string {
  return input.replace(/([\\"])/g, "\\$1");
}

/**
 * Builds the Lucene query for a plain search box.
 *
 * Two things make the obvious query useless. The release-group index searches
 * the *title* by default, so "Pink Floyd" looks for albums called "Pink Floyd"
 * and finds nothing they made. And the default operator is OR, so "The Wall"
 * matches anything containing "the" — thousands of records, none of them ranked
 * usefully.
 *
 * So: every term has to appear in the title or the artist, and an exact match on
 * either is boosted hard enough to reach the top.
 */
function buildSearchQuery(input: string, types: string[]): string {
  const terms = input.split(/\s+/).filter(Boolean);
  const phrase = escapePhrase(input);

  const perTerm = terms
    .map((term) => {
      const t = escapeLucene(term);
      return `(releasegroup:${t} OR artist:${t})`;
    })
    .join(" AND ");

  const clauses = [
    `releasegroup:"${phrase}"^8`,
    `artist:"${phrase}"^4`,
    `(${perTerm})`,
  ];

  const search = `(${clauses.join(" OR ")})`;
  if (!types.length) return search;

  return `${search} AND primarytype:(${types.join(" OR ")})`;
}

/**
 * How far to push a release group down for being a derivative rather than the
 * record itself. Searching an artist should surface their studio albums, not
 * forty compilations and a live bootleg.
 */
const SECONDARY_TYPE_PENALTY: Record<string, number> = {
  Compilation: 45,
  Live: 35,
  Remix: 40,
  "DJ-mix": 50,
  Interview: 70,
  Demo: 30,
  Soundtrack: 12,
  Audiobook: 80,
  Spokenword: 70,
  "Audio drama": 80,
  "Mixtape/Street": 25,
};

const DEFAULT_SECONDARY_PENALTY = 25;

/** Lowercase, strip punctuation and collapse spaces, for comparing titles. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * MusicBrainz scores by text match alone, which ranks a 2011 compilation the
 * same as the album everyone means. Re-rank on top of its score.
 */
function relevanceOf(result: AlbumSearchResult, query: string): number {
  const wanted = normalise(query);
  const title = normalise(result.title);
  const artist = normalise(result.artistName);

  let score = result.score;

  if (title === wanted) score += 60;
  else if (title.startsWith(wanted)) score += 25;

  // "pink floyd" should bring back everything they made, not just an album of
  // that name — so an artist match counts nearly as much as a title match.
  if (artist === wanted) score += 50;
  else if (wanted.includes(artist) && artist.length > 3) score += 35;

  for (const type of result.secondaryTypes) {
    score -= SECONDARY_TYPE_PENALTY[type] ?? DEFAULT_SECONDARY_PENALTY;
  }

  if (result.primaryType === "Album") score += 5;

  return score;
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

  // Ask for more than we show: re-ranking can only reorder what it is given,
  // and the record you want is often outside MusicBrainz's own top 24.
  const fetchLimit = Math.min(100, Math.max(limit * 3, 50));

  const data = await mbFetch<{ "release-groups"?: MBReleaseGroup[] }>(
    "/release-group",
    { query: buildSearchQuery(trimmed, types), limit: String(fetchLimit) },
  );

  const groups = data["release-groups"] ?? [];

  const ranked = groups.map((rg) => {
    const result = toSearchResult(rg);
    return { result, relevance: relevanceOf(result, trimmed) };
  });

  // MusicBrainz happily returns the same album as several release-groups when
  // reissues were modelled separately; collapse on title+artist, keep the best.
  const seen = new Map<string, (typeof ranked)[number]>();
  for (const candidate of ranked) {
    const key = `${normalise(candidate.result.title)}::${normalise(candidate.result.artistName)}`;
    const existing = seen.get(key);
    if (!existing || candidate.relevance > existing.relevance) {
      seen.set(key, candidate);
    }
  }

  return [...seen.values()]
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      // Same relevance: the original release beats the reissue.
      return (a.result.year ?? 9999) - (b.result.year ?? 9999);
    })
    .slice(0, limit)
    .map((candidate) => candidate.result);
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
