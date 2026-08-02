# Wax — Claude Code context

Album logging app (Letterboxd for records). Next.js 15 App Router, React 19, Tailwind v4, Drizzle ORM, libSQL/Turso, MusicBrainz API.

## Quick orientation

```
src/
  app/                    App Router routes (server components unless noted)
    search/               Tabbed album + artist search with filter chips
    artist/[id]/          Artist page with grouped discography
    album/[id]/           Album detail: sleeve flip, tracklist, play links
    album/[id]/log/       Log / rate / review form
    library/              Grid, sorted by rating | title | artist | year
    watchlist/            Listen-later list
    api/albums/[id]/tracks/  Tracklist endpoint (called by the flip card)
    api/health/           Deployment diagnostic; reports credential presence, never values
  components/             Shared UI: AlbumCard, AlbumSleeve, PlayLinks, Stars, …
  db/
    schema.ts             users · albums · entries · watchlist · mbCache
    index.ts              libSQL connection + startup migration + getCurrentUser()
  lib/
    musicbrainz.ts        Rate-limited MusicBrainz client (the most-edited file)
    mbCache.ts            Durable MusicBrainz response cache (SQLite table)
    queries.ts            All reads (React cache() wrappers)
    actions.ts            All writes (server actions)
    coverart.ts           Cover Art Archive URL helpers
    format.ts             formatStars, formatDuration, …
drizzle/                  Committed migrations, applied on startup
```

## Database

- **Local dev**: `file:./wax.db` (created on first run, no setup needed)
- **Production**: Turso. Set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
- Migrations in `drizzle/` are committed and applied automatically on boot. After a schema change: `npm run db:generate` then commit the new migration file.
- Never `db:push` in production — it bypasses the migration journal.
- Ratings stored as integers 1–10 (half-stars). `formatStars(8)` → `"4.0"`.

## MusicBrainz client (`src/lib/musicbrainz.ts`)

**Hard constraints — don't relax these without understanding the consequences:**
- 1 request per second per IP. The queue in `schedule()` enforces 1100 ms between calls.
- Descriptive `User-Agent` is required. Controlled by `MUSICBRAINZ_CONTACT` env var (`.env.local`). Default is the repo URL; override to an email for better traceability.
- 503 responses are retried (not surfaced) because the per-IP limit is shared on serverless hosts.
- `MUSICBRAINZ_BASE_URL` overrides the API root — the only test seam. Tests point this at a local stub; nothing else should set it.

**Caches:**
- Search results: 12 hours
- Lookups (release groups, artists, releases): 7 days
- Both land in `mb_cache` (SQLite), shared across instances and cold starts.

**Search query shape:**
```
(releasegroup:"The Wall"^8 OR artist:"The Wall"^4 OR ((releasegroup:The OR artist:The) AND (releasegroup:Wall OR artist:Wall)))
AND primarytype:(album) AND -secondarytype:[* TO *]
```
Default filter is studio albums only (`primarytype:album`, no secondary types). Filter chips let the user widen.

**Artist pages use `lookupArtistWithReleases`** (browse by artist MBID) rather than search — search returns a scored sample of the catalogue, browse returns the whole thing. This is the permanent fix for the "Placebo self-titled missing entirely" problem.

**Streaming links** come from two sources that are merged:
- Release-group fetch (initial album cache)
- Release fetch (when the tracklist is first loaded)
`mergeLinks()` in `musicbrainz.ts` handles the merge. `getExternalLinks()` in `queries.ts` only asks the release if the group gave nothing.

## Key design decisions

**Album search and artist search are separate.** A one-word artist query makes every record by that artist score equally — no re-ranking recovers an album that never appeared. Artist pages browse the discography by MBID instead.

**Tracklists load on demand.** Fetching the tracklist needs the release, not just the release group, costing an extra MusicBrainz request. `AlbumSleeve` only triggers this on the first flip.

**`externalUrls: null` vs `{}`:** Null means never asked; an empty object means asked and nothing was found. Only null triggers a fresh fetch.

**`tracks: null` vs `[]`:** Same idiom. Null means never fetched; an empty array means fetched and the release had no tracklist.

**Ratings:** Integer 1–10 (half-stars). Sort and average stay exact. `formatStars` converts for display.

**Auth:** Single-user. `getCurrentUser()` always returns the `local` account. Every row already has `userId`, so adding real auth is swapping one function, no migration.

## Sandbox limitation (remote dev only)

MusicBrainz and Cover Art Archive are **blocked** in this remote execution environment (403 on CONNECT). All MusicBrainz behaviour must be tested via local stubs using `MUSICBRAINZ_BASE_URL`. Don't assume a search that works against the real API will have the same behaviour against the stub and vice versa.

## Common tasks

**Add a new page:**  follow `src/app/album/[id]/page.tsx` as a pattern — server component, async data fetch via `queries.ts`, `Suspense` for slow parts.

**Add a new DB column:**  edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`. The app picks it up on next boot.

**Change search ranking:**  `relevanceOf()` and `betterOf()` in `musicbrainz.ts`.

**Change what streaming services appear:**  `PlayLinks.tsx` — the `services` array and the `.filter()` at the bottom.

**Diagnose a broken deployment:**  `GET /api/health` — reports database mode, credential presence, and the real error if there is one. Never reveals credential values.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | `file:./wax.db` | Local SQLite |
| `TURSO_DATABASE_URL` | unset | Hosted DB. Setting this switches off the local file. |
| `TURSO_AUTH_TOKEN` | unset | Required when `TURSO_DATABASE_URL` is set. |
| `MUSICBRAINZ_CONTACT` | repo URL | Email or URL. Goes in the User-Agent. Set in `.env.local`, never committed. |
| `MUSICBRAINZ_BASE_URL` | `https://musicbrainz.org/ws/2` | Tests only. |
| `NEXT_PUBLIC_UNOPTIMIZED_IMAGES` | unset | Set to `1` behind proxies that block the CAA CDN. |

## Branch

Active development branch: `claude/music-scraping-sources-2ijvi5`
