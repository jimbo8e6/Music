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
npm run db:push     # creates ./wax.db from the Drizzle schema
npm run dev         # http://localhost:3000
```

Optional starter data:

```bash
npm run db:seed              # just the local account
npm run db:seed -- --albums  # plus a handful of rated albums
```

`db:seed` resolves each album against MusicBrainz at run time rather than
hard-coding MBIDs, so it needs network access. Without it the script still
creates the account and exits cleanly.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `./wax.db` | SQLite file path |
| `MUSICBRAINZ_CONTACT` | repo URL | Goes in the `User-Agent`; MusicBrainz asks for a real contact and throttles anonymous clients harder |
| `NEXT_PUBLIC_UNOPTIMIZED_IMAGES` | unset | Set to `1` to bypass Next's image optimiser (useful behind a proxy that blocks the Archive CDN) |

## How it fits together

```
src/
  app/                 routes (App Router, all server components bar the forms)
  components/          AlbumCard, Stars, StarInput, ReviewForm, …
  db/schema.ts         users · albums · entries · watchlist
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

SQLite plus `better-sqlite3` needs a persistent filesystem, so this runs on
Fly.io, Railway or a VPS as-is. On Vercel, swap the driver for libSQL/Turso —
the Drizzle schema and every query carry over unchanged.
