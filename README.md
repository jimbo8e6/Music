# Wax

Letterboxd, but for albums. Log what you listen to, rate it out of five stars,
write about it, and keep the whole thing in one dark, artwork-first grid.

- **Search** albums via MusicBrainz — no API key, no account.
- **Artwork** from the Cover Art Archive at up to 1200px, with a generated
  colour tile when an album has no cover uploaded.
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
  components/          AlbumCard, Stars, StarInput, ReviewForm, …
  db/schema.ts         users · albums · entries · watchlist
  db/index.ts          connection + startup migration + getCurrentUser()
drizzle/               generated migrations — committed, applied on boot
  lib/musicbrainz.ts   rate-limited API client
  lib/coverart.ts      Cover Art Archive URL building
  lib/queries.ts       reads
  lib/actions.ts       writes (server actions)
```

**Albums are cached, not mirrored.** Nothing is stored until you open an album
page; `getOrFetchAlbum` reads the local row or fetches and inserts it. The
database stays small and only holds records you've actually touched.

**Ratings are integers.** Half stars are stored as 1–10 rather than a float, so
sorting and averaging stay exact. `formatStars` renders them back as `4.5`.

**The API client self-throttles.** MusicBrainz allows one request per second per
IP and blocks clients without a descriptive `User-Agent`. `src/lib/musicbrainz.ts`
serialises every call through a queue with a 1.1s gap, so callers never have to
think about it. This does mean search feels slower than a commercial API — that
is the rate limit, not the app.

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
