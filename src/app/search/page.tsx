import { inArray } from "drizzle-orm";

import { AlbumCard } from "@/components/AlbumCard";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "@/components/SearchBox";
import { db, getCurrentUser, schema } from "@/db";
import { coverArtUrlForMbid } from "@/lib/coverart";
import { MusicBrainzError, searchAlbums } from "@/lib/musicbrainz";
import { and, eq } from "drizzle-orm";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-xl space-y-2">
        <h1 className="text-center text-xl font-semibold">Find an album</h1>
        <SearchBox
          defaultValue={query}
          autoFocus={!query}
          placeholder="Album, artist, or both…"
        />
      </div>

      {query ? <Results query={query} /> : null}
    </div>
  );
}

async function Results({ query }: { query: string }) {
  try {
    const results = await searchAlbums(query);

    if (results.length === 0) {
      return (
        <EmptyState
          title={`Nothing found for “${query}”`}
          body="MusicBrainz indexes by exact-ish spelling. Try the artist name on its own, or drop punctuation and subtitles."
        />
      );
    }

    // One query tells us which of these are already in the library, so cards
    // can show the rating the user already gave.
    const ratings = ratingsFor(results.map((result) => result.mbid));

    return (
      <section className="space-y-4">
        <p className="text-mist-400 text-xs tracking-wider uppercase">
          {results.length} result{results.length === 1 ? "" : "s"}
        </p>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {results.map((result, index) => (
            <AlbumCard
              key={result.mbid}
              href={`/album/${result.mbid}`}
              title={result.title}
              artist={result.artistName}
              year={result.year}
              coverUrl={coverArtUrlForMbid(result.mbid, 500)}
              rating={ratings.get(result.mbid) ?? null}
              priority={index < 6}
            />
          ))}
        </div>
      </section>
    );
  } catch (error) {
    const message =
      error instanceof MusicBrainzError
        ? error.message
        : "Couldn't reach MusicBrainz. Check your connection and try again.";

    return (
      <div
        role="alert"
        className="surface border-red-500/30 bg-red-500/5 px-6 py-10 text-center"
      >
        <p className="text-sm text-red-300">{message}</p>
      </div>
    );
  }
}

/** Existing ratings for these album ids, keyed by id. */
function ratingsFor(ids: string[]): Map<string, number | null> {
  if (ids.length === 0) return new Map();

  const user = getCurrentUser();
  const rows = db
    .select({ albumId: schema.entries.albumId, rating: schema.entries.rating })
    .from(schema.entries)
    .where(
      and(
        eq(schema.entries.userId, user.id),
        inArray(schema.entries.albumId, ids),
      ),
    )
    .all();

  return new Map(rows.map((row) => [row.albumId, row.rating]));
}
