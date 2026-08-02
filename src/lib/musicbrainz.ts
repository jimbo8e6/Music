/**
 * Minimal MusicBrainz web-service client.
 *
 * Two rules the API enforces and will block you for ignoring:
 *   1. A descriptive User-Agent with contact details.
 *   2. No more than one request per second, per IP.
 * Both are handled here so callers never have to think about them.
 */

import { cache } from "react";

import { readCache, writeCache } from "@/lib/mbCache";


// Overridable so the app can be pointed at a stub when testing; nothing but
// tests should ever set it.
const MB_BASE =
  process.env.MUSICBRAINZ_BASE_URL ?? "https://musicbrainz.org/ws/2";

// MusicBrainz accepts a URL or an email here — it only needs a way to reach
// whoever is running the client. The repo URL is a valid contact on its own, so
// this default works with no configuration; override it in .env.local to be
// reachable more directly.
const CONTACT =
  process.env.MUSICBRAINZ_CONTACT ?? "https://github.com/jimbo8e6/music";
const USER_AGENT = `Wax/0.1.0 ( ${CONTACT} )`;

/** MusicBrainz allows 1 req/s; 1100ms leaves room for clock jitter. */
const MIN_INTERVAL_MS = 1100;

/**
 * How long an answer stays good. MusicBrainz data barely moves, and the point
 * of a long window is that a throttled request is one we never had to make.
 */
const CACHE_MS = {
  search: 12 * 60 * 60 * 1000,
  lookup: 7 * 24 * 60 * 60 * 1000,
} as const;

/**
 * Throttling is normal rather than exceptional here: the limit is per IP, and a
 * shared host shares that IP with everyone else on it. So a 503 is worth
 * waiting out rather than showing to whoever is reading the page.
 */
const RETRY_DELAYS_MS = [1200, 2600];

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

async function mbFetch<T>(
  path: string,
  params: Record<string, string>,
  { cacheMs = CACHE_MS.search }: { cacheMs?: number } = {},
): Promise<T> {
  const url = new URL(`${MB_BASE}${path}`);
  url.searchParams.set("fmt", "json");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const key = url.toString();

  const cached = await readCache(key, cacheMs);
  if (cached !== null) return cached as T;

  const body = await mbFetchUncached<T>(url, path);
  await writeCache(key, body);
  return body;
}

async function mbFetchUncached<T>(url: URL, path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(url, path);
    } catch (error) {
      const throttled =
        error instanceof MusicBrainzError && error.status === 503;
      if (!throttled || attempt >= RETRY_DELAYS_MS.length) throw error;

      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

function requestOnce<T>(url: URL, path: string): Promise<T> {
  return schedule(async () => {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        // Upstream data barely moves; our own DB is the real cache.
        next: { revalidate: 60 * 60 * 24 },
        // Their search server occasionally stalls. Fail with something the
        // page can explain rather than spinning until the platform gives up.
        signal: AbortSignal.timeout(12_000),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new MusicBrainzError(
          "MusicBrainz took too long to respond. It does this occasionally — try again.",
        );
      }
      throw error;
    }

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
function buildSearchQuery(
  input: string,
  spec: FilterSpec,
  { excludeSecondary = true }: { excludeSecondary?: boolean } = {},
): string {
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

  const parts = [`(${clauses.join(" OR ")})`];

  if (spec.types.length) {
    parts.push(`primarytype:(${spec.types.join(" OR ")})`);
  }

  if (spec.secondary === "none") {
    // Lucene's "this field is absent". Some deployments reject it, hence the
    // caller's ability to drop it and fall back to filtering the results.
    if (excludeSecondary) parts.push("-secondarytype:[* TO *]");
  } else if (spec.secondary !== "any") {
    parts.push(`secondarytype:${escapeLucene(spec.secondary.toLowerCase())}`);
  }

  return parts.join(" AND ");
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

/**
 * Words that mark a repackage rather than the record itself. A remaster or box
 * set is the same album with a longer name, and the longer name is exactly what
 * lets it score well — so it needs pushing back under the original.
 */
const EDITION_NOISE = new Set([
  "remaster",
  "remastered",
  "deluxe",
  "expanded",
  "anniversary",
  "edition",
  "reissue",
  "immersion",
  "bonus",
  "collectors",
  "definitive",
  "redux",
  "recorded",
]);

/** Lowercase, strip punctuation and collapse spaces, for comparing titles. */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensOf(value: string): string[] {
  return value.split(" ").filter(Boolean);
}

/**
 * True when the query is this artist and this album and nothing else — "pink
 * floyd the wall", "who are you the who", in either order.
 *
 * This is the strongest statement a search box can make, and it needs to beat
 * every partial signal: without it, an artist match alone puts the band's whole
 * discography on equal footing and the album asked for lands mid-list.
 */
function namesArtistAndTitle(
  wanted: string,
  artist: string,
  title: string,
): boolean {
  if (!artist || !title) return false;

  const remove = (haystack: string, needle: string) =>
    haystack.includes(needle)
      ? haystack.replace(needle, " ").replace(/\s+/g, " ").trim()
      : null;

  return remove(wanted, artist) === title || remove(wanted, title) === artist;
}

/**
 * MusicBrainz scores by text match alone, which ranks a 2011 compilation the
 * same as the album everyone means. Re-rank on top of its score.
 *
 * The two signals that matter are symmetric:
 *
 *   coverage  — how much of what you typed is explained by this record at all.
 *               "pink floyd the wall" is fully explained by the album The Wall
 *               credited to Pink Floyd: nothing you typed is left over.
 *   precision — how much of the record's title you actually asked for. Both
 *               "The Wall" and "Is There Anybody Out There? The Wall Live
 *               1980–81" contain your words, but only the first is *about*
 *               them, and precision is what separates the two.
 *
 * Neither alone is enough. Coverage on its own promotes anything by the right
 * artist; precision on its own promotes short titles regardless of who made
 * them.
 */
function relevanceOf(result: AlbumSearchResult, query: string): number {
  const wanted = normalise(query);
  const title = normalise(result.title);
  const artist = normalise(result.artistName);

  let score = result.score;

  const queryTokens = tokensOf(wanted);
  const titleTokens = tokensOf(title);
  const inTitle = new Set(titleTokens);
  const inArtist = new Set(tokensOf(artist));

  // Count each distinct word once: bands like The Who repeat words between
  // their name and their titles, which would otherwise skew coverage.
  const distinctQueryTokens = [...new Set(queryTokens)];

  if (distinctQueryTokens.length && titleTokens.length) {
    const covered = distinctQueryTokens.filter(
      (token) => inTitle.has(token) || inArtist.has(token),
    ).length;
    score += (covered / distinctQueryTokens.length) * 50;

    // Precision only means something if a title was asked for. When the query
    // is purely an artist name it would just reward albums that repeat the
    // band's name — "The Who Sell Out" over "Who's Next" for no good reason.
    if (artist !== wanted) {
      const asked = titleTokens.filter((token) => wanted.includes(token)).length;
      score += (asked / titleTokens.length) * 35;
    }
  }

  // The query names the artist and the album together. Decisive.
  if (namesArtistAndTitle(wanted, artist, title)) score += 70;

  // Whole-field matches, for when the query is just one or the other. Only
  // exact equality earns this: a prefix bonus double-counts what precision
  // already measures, and it rewards titles padded with the artist's own name.
  if (title === wanted) score += 60;

  // A repackage carries the original's title plus decoration, which scores well
  // on text alone. Discount it so the album itself stays on top.
  const noise = titleTokens.filter((token) => EDITION_NOISE.has(token)).length;
  if (noise > 0) score -= Math.min(noise * 18, 36);

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

/**
 * What counts as a result.
 *
 * "studio" is the default because it is what people mean by an album: a record
 * the artist made, not the live document, the best-of or the soundtrack. Those
 * are all still reachable, just not mixed into the answer by default.
 */
export type AlbumFilter = "studio" | "eps" | "live" | "compilations" | "all";

interface FilterSpec {
  label: string;
  /** MusicBrainz primary types; empty means no restriction. */
  types: string[];
  /** Required secondary type, "none" for records that have no secondary type. */
  secondary: "none" | "any" | string;
}

export const ALBUM_FILTERS: Record<AlbumFilter, FilterSpec> = {
  studio: { label: "Studio albums", types: ["album"], secondary: "none" },
  eps: { label: "EPs", types: ["ep"], secondary: "any" },
  live: { label: "Live", types: ["album", "ep"], secondary: "Live" },
  compilations: {
    label: "Compilations",
    types: ["album", "ep"],
    secondary: "Compilation",
  },
  all: { label: "Everything", types: [], secondary: "any" },
};

export function isAlbumFilter(value: unknown): value is AlbumFilter {
  return typeof value === "string" && value in ALBUM_FILTERS;
}

/** Does this result belong in the filter, judged on the data itself? */
function matchesFilter(result: AlbumSearchResult, spec: FilterSpec): boolean {
  if (spec.types.length) {
    const primary = (result.primaryType ?? "").toLowerCase();
    if (!spec.types.includes(primary)) return false;
  }

  if (spec.secondary === "none") return result.secondaryTypes.length === 0;
  if (spec.secondary === "any") return true;
  return result.secondaryTypes.includes(spec.secondary);
}

export interface SearchOptions {
  limit?: number;
  filter?: AlbumFilter;
}

/**
 * Free-text album search. Defaults to albums and EPs, which is what people mean
 * when they say "album" — singles and broadcasts just add noise.
 */
async function fetchReleaseGroups(
  query: string,
  limit: number,
): Promise<MBReleaseGroup[]> {
  const data = await mbFetch<{ "release-groups"?: MBReleaseGroup[] }>(
    "/release-group",
    { query, limit: String(limit) },
  );
  return data["release-groups"] ?? [];
}

/**
 * Album search, for when you know what record you want.
 *
 * Looking up an artist's catalogue is a different question with a different
 * answer — see `searchArtists` and `getArtistReleaseGroups` — so this stays a
 * single request and does not try to guess which one you meant.
 */
export async function searchAlbums(
  query: string,
  { limit = 24, filter = "studio" }: SearchOptions = {},
): Promise<AlbumSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const spec = ALBUM_FILTERS[filter];

  // Ask for more than we show, since re-ranking can only reorder what it is
  // given — but not much more. MusicBrainz slows down noticeably on large
  // result sets, and the album you meant is never 80 places down.
  const fetchLimit = Math.min(60, Math.max(limit * 2, 40));

  let groups: MBReleaseGroup[];
  try {
    groups = await fetchReleaseGroups(
      buildSearchQuery(trimmed, spec),
      fetchLimit,
    );
  } catch (error) {
    // The absent-field clause is the only part that can be rejected outright.
    // Drop it and let the local filter do the work instead of failing the page.
    if (!(error instanceof MusicBrainzError && error.status === 400)) throw error;
    groups = await fetchReleaseGroups(
      buildSearchQuery(trimmed, spec, { excludeSecondary: false }),
      fetchLimit,
    );
  }

  const ranked = groups.map((rg) => {
    const result = toSearchResult(rg);
    return { result, relevance: relevanceOf(result, trimmed) };
  });

  const kept = ranked.filter(({ result }) => matchesFilter(result, spec));

  // MusicBrainz happily returns the same album as several release-groups when
  // reissues were modelled separately; collapse on title+artist, keep the best.
  // Same title, same artist, equal relevance means the same record twice — and
  // then the one that came out first is the album, the other is the reissue.
  const seen = new Map<string, (typeof ranked)[number]>();
  for (const candidate of kept) {
    const key = `${normalise(candidate.result.title)}::${normalise(candidate.result.artistName)}`;
    const existing = seen.get(key);
    if (!existing || betterOf(candidate, existing)) seen.set(key, candidate);
  }

  return [...seen.values()]
    .sort((a, b) => (betterOf(a, b) ? -1 : betterOf(b, a) ? 1 : 0))
    .slice(0, limit)
    .map((candidate) => candidate.result);
}

interface RankedResult {
  result: AlbumSearchResult;
  relevance: number;
}

/** Higher relevance wins; on a tie the earlier release does. */
function betterOf(a: RankedResult, b: RankedResult): boolean {
  if (a.relevance !== b.relevance) return a.relevance > b.relevance;
  return (a.result.year ?? 9999) < (b.result.year ?? 9999);
}

export interface ExternalLinks {
  spotify?: string;
  appleMusic?: string;
  bandcamp?: string;
  youtube?: string;
}

interface MBRelation {
  url?: { resource?: string };
}

/**
 * Streaming links, read straight off MusicBrainz's URL relations.
 *
 * Matched on host rather than relation type: contributors file these under
 * "streaming", "free streaming" and others inconsistently, but the address
 * itself is unambiguous.
 */
export function streamingLinksFrom(
  relations: MBRelation[] | undefined,
): ExternalLinks {
  const links: ExternalLinks = {};

  for (const relation of relations ?? []) {
    const url = relation.url?.resource;
    if (!url) continue;

    let host: string;
    try {
      host = new URL(url).host.toLowerCase();
    } catch {
      continue;
    }

    if (!links.spotify && host.endsWith("open.spotify.com")) links.spotify = url;

    if (
      !links.appleMusic &&
      (host.endsWith("music.apple.com") || host.endsWith("itunes.apple.com"))
    ) {
      links.appleMusic = url;
    }

    // Artists get their own subdomain, so match the suffix rather than the host.
    if (!links.bandcamp && (host === "bandcamp.com" || host.endsWith(".bandcamp.com"))) {
      links.bandcamp = url;
    }

    if (host === "music.youtube.com") {
      // Prefer the music front end over a plain video link, even a later one.
      links.youtube = url;
    } else if (
      !links.youtube &&
      (host.endsWith("youtube.com") || host === "youtu.be")
    ) {
      links.youtube = url;
    }
  }

  return links;
}

/** Later links fill gaps in earlier ones; the first source wins a conflict. */
export function mergeLinks(...sources: ExternalLinks[]): ExternalLinks {
  const merged: ExternalLinks = {};
  for (const source of sources) {
    for (const [key, value] of Object.entries(source) as [keyof ExternalLinks, string][]) {
      if (value && !merged[key]) merged[key] = value;
    }
  }
  return merged;
}

export interface AlbumDetail extends AlbumSearchResult {
  genres: string[];
  /**
   * The release to ask for a tracklist. Release-groups don't carry one, and
   * fetching it here would cost a second request — which the rate limiter must
   * space a full second after the first, delaying the whole page. The album
   * page loads this separately once it is already on screen.
   */
  primaryReleaseId: string | null;
  externalUrls: ExternalLinks;
}

/** Everything the album page needs up front, in a single request. */
export async function lookupAlbum(mbid: string): Promise<AlbumDetail> {
  const rg = await mbFetch<MBReleaseGroup & { relations?: MBRelation[] }>(
    `/release-group/${mbid}`,
    // url-rels rides along on a request we were making anyway, so the streaming
    // links cost nothing extra.
    { inc: "artist-credits+releases+genres+url-rels" },
    { cacheMs: CACHE_MS.lookup },
  );

  const base = toSearchResult(rg);
  const genres = (rg.genres ?? [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((g) => g.name);

  return {
    ...base,
    genres,
    primaryReleaseId: rg.releases?.[0]?.id ?? null,
    externalUrls: streamingLinksFrom(rg.relations),
  };
}

/**
 * Streaming links for an album already cached without them.
 *
 * Its own request, but a cheap one: the response is cached for a week, and
 * only albums stored before links were collected ever need it.
 */
export async function fetchExternalLinks(mbid: string): Promise<ExternalLinks> {
  try {
    const rg = await mbFetch<{ relations?: MBRelation[] }>(
      `/release-group/${mbid}`,
      { inc: "artist-credits+releases+genres+url-rels" },
      { cacheMs: CACHE_MS.lookup },
    );
    return streamingLinksFrom(rg.relations);
  } catch {
    return {};
  }
}

export interface Track {
  /** Position within its medium, as printed on the sleeve. */
  position: number;
  title: string;
  lengthMs: number | null;
  /** 1-based disc number; only worth showing when a release has several. */
  medium: number;
}

export interface Tracklist {
  tracks: Track[];
  count: number;
  mediumCount: number;
}

interface MBMedium {
  position?: number;
  "track-count"?: number;
  tracks?: { position?: number; number?: string; title?: string; length?: number }[];
}

/**
 * The tracklist of a release, and its total length.
 *
 * Release groups carry no tracklist, so this asks a specific release. It is the
 * same request the track count needs, so the titles come along for free.
 *
 * Best-effort: a release MusicBrainz has no tracklist for is not worth failing
 * a page over, so this returns null rather than throwing.
 */
export interface ReleaseDetail {
  tracklist: Tracklist | null;
  /** Releases often carry links the release group doesn't. */
  links: ExternalLinks;
}

export async function fetchRelease(releaseId: string): Promise<ReleaseDetail> {
  try {
    const release = await mbFetch<{ media?: MBMedium[]; relations?: MBRelation[] }>(
      `/release/${releaseId}`,
      { inc: "recordings+url-rels" },
      { cacheMs: CACHE_MS.lookup },
    );

    const media = release.media ?? [];
    const tracks: Track[] = [];

    media.forEach((medium, index) => {
      const mediumNumber = medium.position ?? index + 1;
      for (const track of medium.tracks ?? []) {
        if (!track.title) continue;
        tracks.push({
          position: track.position ?? Number(track.number) ?? tracks.length + 1,
          title: track.title,
          lengthMs: typeof track.length === "number" ? track.length : null,
          medium: mediumNumber,
        });
      }
    });

    const count =
      media.reduce((sum, medium) => sum + (medium["track-count"] ?? 0), 0) ||
      tracks.length;

    return {
      tracklist: count ? { tracks, count, mediumCount: media.length || 1 } : null,
      links: streamingLinksFrom(release.relations),
    };
  } catch {
    return { tracklist: null, links: {} };
  }
}

/**
 * Studio albums first released on or after `fromDate` (ISO date: YYYY-MM-DD).
 * Sorted newest-first. Returns [] gracefully when MusicBrainz is unreachable.
 */
export async function fetchNewReleases(
  fromDate: string,
  { limit = 12 }: { limit?: number } = {},
): Promise<AlbumSearchResult[]> {
  const query = `primarytype:(album) AND -secondarytype:[* TO *] AND firstreleasedate:[${fromDate} TO *]`;
  try {
    const groups = await fetchReleaseGroups(query, Math.min(limit * 3, 50));
    return groups
      .map(toSearchResult)
      .filter(r => r.primaryType === "Album" && r.secondaryTypes.length === 0 && r.releaseDate)
      .sort((a, b) => {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return b.releaseDate.localeCompare(a.releaseDate);
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Artists                                                                    */
/* -------------------------------------------------------------------------- */

export interface ArtistSearchResult {
  mbid: string;
  name: string;
  /** MusicBrainz's own tie-breaker, e.g. "British rock band" — often the only
   *  way to tell two identically named bands apart. */
  disambiguation: string | null;
  /** "Group", "Person", "Orchestra", … */
  type: string | null;
  country: string | null;
  beganYear: number | null;
  endedYear: number | null;
  score: number;
}

interface MBArtist {
  id: string;
  name: string;
  disambiguation?: string;
  type?: string | null;
  country?: string | null;
  "life-span"?: { begin?: string; end?: string; ended?: boolean };
  genres?: { name: string; count: number }[];
  score?: number;
}

function toArtistResult(artist: MBArtist): ArtistSearchResult {
  return {
    mbid: artist.id,
    name: artist.name,
    disambiguation: artist.disambiguation?.trim() || null,
    type: artist.type ?? null,
    country: artist.country ?? null,
    beganYear: yearOf(artist["life-span"]?.begin),
    endedYear: yearOf(artist["life-span"]?.end),
    score: artist.score ?? 0,
  };
}

/**
 * Artist search. The artist index defaults to the name field, but shares the
 * OR-by-default problem, so every word is required and the whole phrase is
 * boosted. Aliases are matched too — plenty of bands are looked up by a name
 * MusicBrainz files them under differently.
 */
export async function searchArtists(
  query: string,
  { limit = 25 }: { limit?: number } = {},
): Promise<ArtistSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const phrase = escapePhrase(trimmed);
  const perTerm = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `artist:${escapeLucene(term)}`)
    .join(" AND ");

  const data = await mbFetch<{ artists?: MBArtist[] }>("/artist", {
    query: `(artist:"${phrase}"^10 OR alias:"${phrase}"^6 OR (${perTerm}))`,
    limit: String(limit),
  });

  const wanted = normalise(trimmed);

  return (data.artists ?? [])
    .map(toArtistResult)
    .sort((a, b) => {
      // An exact name match is what you meant, whatever the text score says.
      const exact = Number(normalise(b.name) === wanted) - Number(normalise(a.name) === wanted);
      return exact !== 0 ? exact : b.score - a.score;
    });
}

export interface ArtistDetail extends ArtistSearchResult {
  genres: string[];
}

/**
 * The artist, and their release groups in the same breath.
 *
 * Asking for the release groups as a sub-resource means one request where the
 * page used to make two — and two requests are more than twice the cost, since
 * the rate limiter has to space the second a full second behind the first.
 *
 * Memoised per request so the page header and the discography, which are
 * rendered separately, share the one answer.
 */
const lookupArtistWithReleases = cache(
  async (mbid: string): Promise<{ artist: ArtistDetail; releaseGroups: MBReleaseGroup[] | null }> => {
    const artist = await mbFetch<MBArtist & { "release-groups"?: MBReleaseGroup[] }>(
      `/artist/${mbid}`,
      { inc: "genres+release-groups" },
      { cacheMs: CACHE_MS.lookup },
    );

    const genres = (artist.genres ?? [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((g) => g.name);

    return {
      artist: { ...toArtistResult(artist), genres },
      // Absent rather than empty means the sub-resource was not returned, and
      // the caller should fall back to browsing.
      releaseGroups: artist["release-groups"] ?? null,
    };
  },
);

export async function lookupArtist(mbid: string): Promise<ArtistDetail> {
  return (await lookupArtistWithReleases(mbid)).artist;
}

export interface Discography {
  releaseGroups: AlbumSearchResult[];
  /** How many MusicBrainz holds, which may exceed what one request returns. */
  total: number;
}

/**
 * Everything an artist released.
 *
 * This is a browse request, not a search: it returns the catalogue itself in
 * full rather than a relevance-scored sample, which is exactly what ranking a
 * one-word artist query could never give us.
 */
export async function getArtistReleaseGroups(
  mbid: string,
  { limit = 100, offset = 0 }: { limit?: number; offset?: number } = {},
): Promise<Discography> {
  let groups: MBReleaseGroup[];
  let total: number;

  // The artist lookup usually carries these already; only pay for a second
  // request when it didn't, or when paging past what it returned.
  const fromLookup = offset === 0 ? (await lookupArtistWithReleases(mbid)).releaseGroups : null;

  if (fromLookup && fromLookup.length > 0) {
    groups = fromLookup;
    total = fromLookup.length;
  } else {
    const data = await mbFetch<{
      "release-groups"?: MBReleaseGroup[];
      "release-group-count"?: number;
    }>(
      "/release-group",
      {
        artist: mbid,
        inc: "artist-credits",
        limit: String(limit),
        offset: String(offset),
      },
      { cacheMs: CACHE_MS.lookup },
    );
    groups = data["release-groups"] ?? [];
    total = data["release-group-count"] ?? groups.length;
  }

  return {
    releaseGroups: groups
      .map(toSearchResult)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    total,
  };
}

/** The sections an artist page is split into, in the order they're shown. */
export type ReleaseSection = "Albums" | "EPs" | "Live" | "Compilations" | "Other";

export function sectionOf(release: AlbumSearchResult): ReleaseSection {
  const secondary = release.secondaryTypes;
  if (secondary.includes("Live")) return "Live";
  if (secondary.includes("Compilation")) return "Compilations";
  if (secondary.length > 0) return "Other";
  if (release.primaryType === "EP") return "EPs";
  if (release.primaryType === "Album") return "Albums";
  return "Other";
}
