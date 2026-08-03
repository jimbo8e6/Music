import Link from "next/link";
import { Suspense } from "react";

import { and, eq, inArray } from "drizzle-orm";

import { AlbumCard } from "@/components/AlbumCard";
import { AlbumGridSkeleton } from "@/components/AlbumGridSkeleton";
import { ArtistCard } from "@/components/ArtistCard";
import { EmptyState } from "@/components/EmptyState";
import { SearchBox } from "@/components/SearchBox";
import { db, getCurrentUser, schema } from "@/db";
import {
  searchSpotifyAlbums,
  searchSpotifyArtists,
  SpotifyError,
} from "@/lib/spotify";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export type SearchMode = "albums" | "artists";

const MODES: { key: SearchMode; label: string; placeholder: string; hint: string }[] = [
  {
    key: "albums",
    label: "Albums",
    placeholder: "Album title…",
    hint: "Powered by Spotify",
  },
  {
    key: "artists",
    label: "Artists",
    placeholder: "Artist or band name…",
    hint: "Powered by Spotify",
  },
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const query = q?.trim() ?? "";
  const mode: SearchMode = type === "artists" ? "artists" : "albums";
  const config = MODES.find((m) => m.key === mode)!;

  return (
    <div className="space-y-8">
      <div className="mx-auto max-w-xl space-y-3">
        <h1 className="text-center text-xl font-semibold">
          {mode === "artists" ? "Find an artist" : "Find an album"}
        </h1>

        <div className="flex justify-center gap-1">
          {MODES.map((m) => {
            const href = query
              ? `/search?q=${encodeURIComponent(query)}&type=${m.key}`
              : `/search?type=${m.key}`;
            const active = m.key === mode;
            return (
              <Link
                key={m.key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "bg-ink-800 text-mist-100 rounded-full px-4 py-1.5 text-sm font-medium"
                    : "text-mist-400 hover:text-mist-100 rounded-full px-4 py-1.5 text-sm transition-colors"
                }
              >
                {m.label}
              </Link>
            );
          })}
        </div>

        <SearchBox
          key={mode}
          defaultValue={query}
          autoFocus={!query}
          placeholder={config.placeholder}
          variant="prominent"
          mode={mode}
        />
        <p className="text-mist-400 text-center text-xs">{config.hint}</p>
      </div>

      {query ? (
        <Suspense
          key={`${mode}:${query}`}
          fallback={<SearchingNotice query={query} mode={mode} />}
        >
          {mode === "artists" ? (
            <ArtistResults query={query} />
          ) : (
            <AlbumResults query={query} />
          )}
        </Suspense>
      ) : null}
    </div>
  );
}

function SearchingNotice({ query, mode }: { query: string; mode: SearchMode }) {
  return (
    <section className="space-y-4" aria-live="polite">
      <p className="text-mist-400 text-xs tracking-wider uppercase">
        Searching for &ldquo;{query}&rdquo;…
      </p>
      {mode === "albums" ? <AlbumGridSkeleton /> : <ArtistListSkeleton />}
    </section>
  );
}

function ArtistListSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-2" aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="surface flex animate-pulse items-center gap-4 p-3">
          <div className="bg-ink-850 h-12 w-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="bg-ink-850 h-3 w-1/3 rounded" />
            <div className="bg-ink-850 h-2.5 w-1/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function UpstreamError({ error }: { error: unknown }) {
  const message =
    error instanceof SpotifyError
      ? error.message
      : "Couldn't reach Spotify. Check your connection and try again.";

  return (
    <div
      role="alert"
      className="surface border-red-500/30 bg-red-500/5 px-6 py-10 text-center"
    >
      <p className="text-sm text-red-300">{message}</p>
    </div>
  );
}

async function ArtistResults({ query }: { query: string }) {
  try {
    const artists = await searchSpotifyArtists(query);

    if (artists.length === 0) {
      return (
        <EmptyState
          title={`No artists found for "${query}"`}
          body="Try an alternate spelling or the full name."
        />
      );
    }

    return (
      <section className="mx-auto max-w-2xl space-y-4">
        <p className="text-mist-400 text-xs tracking-wider uppercase">
          {artists.length} artist{artists.length === 1 ? "" : "s"}
        </p>
        <div className="space-y-2">
          {artists.map((artist) => (
            <ArtistCard
              key={artist.spotifyId}
              href={`/artist/${artist.spotifyId}`}
              name={artist.name}
              imageUrl={artist.artworkUrl}
              meta={artist.genres.slice(0, 3).join(" · ") || null}
            />
          ))}
        </div>
      </section>
    );
  } catch (error) {
    return <UpstreamError error={error} />;
  }
}

async function AlbumResults({ query }: { query: string }) {
  try {
    const results = await searchSpotifyAlbums(query);

    if (results.length === 0) {
      return (
        <EmptyState
          title={`No albums found for "${query}"`}
          body="Try searching by artist name instead."
          actionHref={`/search?q=${encodeURIComponent(query)}&type=artists`}
          actionLabel="Search artists"
        />
      );
    }

    const ratings = await ratingsFor(results.map((r) => r.spotifyId));

    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-mist-400 text-xs tracking-wider uppercase">
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
          <Link
            href={`/search?q=${encodeURIComponent(query)}&type=artists`}
            className="text-mist-400 hover:text-accent-400 text-xs transition-colors"
          >
            Looking for an artist? →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {results.map((result, index) => (
            <AlbumCard
              key={result.spotifyId}
              href={`/album/${result.spotifyId}`}
              title={result.title}
              artist={result.artistName}
              year={result.year}
              coverUrl={result.artworkUrl}
              rating={ratings.get(result.spotifyId) ?? null}
              badge={result.albumType !== "album" ? capitalise(result.albumType) : null}
              priority={index < 6}
            />
          ))}
        </div>
      </section>
    );
  } catch (error) {
    return <UpstreamError error={error} />;
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function ratingsFor(ids: string[]): Promise<Map<string, number | null>> {
  if (ids.length === 0) return new Map();

  const user = await getCurrentUser();
  const rows = await db
    .select({ albumId: schema.entries.albumId, rating: schema.entries.rating })
    .from(schema.entries)
    .where(
      and(eq(schema.entries.userId, user.id), inArray(schema.entries.albumId, ids)),
    );

  return new Map(rows.map((row) => [row.albumId, row.rating]));
}
