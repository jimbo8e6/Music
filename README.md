# Wax

Letterboxd, but for albums. Log what you listen to, rate it out of five stars,
write about it, and keep the whole thing in one dark, artwork-first grid.

- **Search albums** by title — studio albums by default, with filters for EPs,
  live records, compilations or everything.
- **Search artists** and browse their whole discography — a separate search,
  because it is a different question.
- Artist pages group releases into albums, EPs, live records and compilations.
- **Artwork** from the Cover Art Archive at up to 1200px, with a generated
  colour tile when an album has no cover uploaded.
- **Turn the sleeve over** on an album page for the back cover, or the
  tracklist when nobody has uploaded one.
- **Play on Spotify or Apple Music** — the album itself where MusicBrainz
  records the link, a search on the service where it doesn't.
- **Rate** in half stars, 0.5 to 5.
- **Review** with an optional headline, a listen date, and a favourite flag.
- **Library** sortable by rating, artist, title or release year.
- **Listen later** for the ones you haven't got to yet.

## Running it

```bash
npm install
npm run dev         # http://localhost:3000
```

The app applies the migrations in `drizzle/` on startup, so `./wax.db` is
created for you on first run — there is no setup step. `npm run db:push` is
still there, but it's for pushing schema edits during development, not for
getting started.

Optional starter data:

```bash
npm run db:seed              # just the local account
npm run db:seed -- --albums  # plus a handful of rated albums
```

`db:seed` resolves each album against MusicBrainz at run time rather than
hard-coding MBIDs, so it needs network access. Without it the script still
creates the account and exits cleanly.

## Configuration

Copy `.env.example` to `.env.local` and edit it. Next.js loads `.env.local`
automatically in both dev and production, and it's gitignored, so your details
stay out of the repo.

```bash
cp .env.example .env.local
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `file:./wax.db` | Local SQLite file |
| `TURSO_DATABASE_URL` | unset | Hosted database. Setting this (with the token) switches the app off the local file — required on serverless hosts |
| `TURSO_AUTH_TOKEN` | unset | Turso token. Required whenever `TURSO_DATABASE_URL` is set |
| `MUSICBRAINZ_CONTACT` | repo URL | Goes in the `User-Agent`; MusicBrainz asks for a real contact and throttles anonymous clients harder |
| `NEXT_PUBLIC_UNOPTIMIZED_IMAGES` | unset | Set to `1` to bypass Next's image optimiser (useful behind a proxy that blocks the Archive CDN) |

## How it fits together

```
src/
  app/                 routes (App Router, all server components bar the forms)
  app/search           tabbed album / artist search
  app/artist/[id]      artist page and discography
  components/          AlbumCard, Stars, StarInput, ReviewForm, …
  db/schema.ts         users · albums · entries · watchlist
  db/index.ts          connection + startup migration + getCurrentUser()
drizzle/               generated migrations — committed, applied on boot
  lib/musicbrainz.ts   rate-limited API client
  lib/coverart.ts      Cover Art Archive URL building
  lib/queries.ts       reads
  lib/actions.ts       writes (server actions)
```

**Album search shows studio albums by default.** A record's derivatives
outnumber it: reissues, best-ofs, live documents and soundtracks all match the
same words. The filter is applied in the query where MusicBrainz supports it and
against the results either way, so an index that rejects the absent-field clause
degrades to the same answer rather than an error.

**Album search and artist search are separate on purpose.** A one-word artist
query matches every record they made equally well, so MusicBrainz has nothing to
rank on and returns an arbitrary slice of the catalogue — no amount of
re-ranking recovers an album that never came back. Artist pages sidestep it
entirely by browsing the discography by artist id, which returns the catalogue
itself rather than a scored sample. Album search stays a single request and only
has to answer "which record is this".

**Streaming links need no Spotify or Apple credentials.** MusicBrainz keeps
them as URL relations, matched here on host rather than relation type, since
contributors file them under several. Coverage is good but not complete, so a
missing link becomes a search on the service — one click away, and never a dead
button.

**Tracklists load on demand.** Back covers hang off a specific release rather
than the release group, which only ever exposes a front, so both the back image
and the tracklist need the release recorded when the album was cached. Neither
is fetched until a sleeve is actually turned over, and the tracklist is stored
on the album row afterwards.

**Albums are cached, not mirrored.** Nothing is stored until you open an album
page; `getOrFetchAlbum` reads the local row or fetches and inserts it. The
database stays small and only holds records you've actually touched.

**Ratings are integers.** Half stars are stored as 1–10 rather than a float, so
sorting and averaging stay exact. `formatStars` renders them back as `4.5`.

**The API client self-throttles, caches and retries.** MusicBrainz allows one
request per second per IP and blocks clients without a descriptive
`User-Agent`. `src/lib/musicbrainz.ts` serialises every call through a queue
with a 1.1s gap.

That gap is per process, which is not enough on a serverless host: instances
start cold with an empty queue, several run at once, and the egress IP is shared
with every other tenant on it — so the per-IP budget is shared too. Two things
make up the difference. Every response is cached in the `mb_cache` table, which
survives cold starts and is shared across instances, so a repeated question
costs nothing. And a 503 is retried with backoff rather than surfaced, because
under a shared IP throttling is ordinary rather than exceptional.

Search still feels slower than a commercial API on a first, uncached query —
that is the rate limit, not the app.

**Single-user, auth-ready.** There is no login. `getCurrentUser()` returns the
seeded `local` account, creating it on first run. Every user-owned row already
carries a `userId` foreign key and every query filters on it, so adding real
accounts means replacing that one resolver with a session lookup — no data
migration.

## Deploying

The app talks to SQLite through libSQL, which reaches both a local file and a
hosted [Turso](https://turso.tech) database with the same driver — so local
development and production run identical code.

**Serverless hosts need Turso.** Vercel, Netlify and Cloudflare give each
function a read-only filesystem that is discarded between invocations, so a
SQLite file has nowhere to live: the app would fail to open the database on
every request, and any rating that did get written would vanish. Point it at a
hosted database instead:

1. Create the database (free tier is far beyond what this app needs):
   ```bash
   turso db create wax
   turso db show wax --url          # -> libsql://wax-you.turso.io
   turso db tokens create wax       # -> the auth token
   ```
2. Apply the schema once:
   ```bash
   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:migrate
   ```
3. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the host's environment
   variables, then redeploy.

Step 2 is belt and braces — the app migrates on startup anyway — but running it
up front means the first request hits a database that is already in shape,
instead of several cold instances racing to build it.

**Hosts with a persistent disk** (Fly.io, Railway, a VPS) need none of this.
Leave the Turso variables unset and the app keeps its SQLite file on the volume.

### Diagnosing a deployment

Next redacts server error messages in production, so a broken deployment shows
an opaque 500 with nothing to go on. `GET /api/health` answers what the pages
cannot:

```bash
curl https://your-app.vercel.app/api/health
```

It reports which database mode the app resolved, whether each credential is
present (never its value), and the real connection error if there is one. A
healthy deployment returns 200 with `"ok": true`.
