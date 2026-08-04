import { notFound } from "next/navigation";
import { Suspense } from "react";

import { and, eq, inArray } from "drizzle-orm";

import { AlbumCard } from "@/components/AlbumCard";
import { AlbumGridSkeleton } from "@/components/AlbumGridSkeleton";
import { activeYears } from "@/components/ArtistCard";
import { db, getOptionalCurrentUser, schema } from "@/db";
import {
  MusicBrainzError,
  getArtistReleaseGroups,
  lookupArtist,
  sectionOf,
  type AlbumSearchResult,
  type ReleaseSection,
} from "@/lib/musicbrainz";
import {
  SpotifyError,
  getSpotifyArtist,
  getSpotifyArtistAlbums,
  isSpotifyId,
  type SpotifyAlbumResult,
} from "@/lib/spotify";
import { coverArtUrlForMbid } from "@/lib/coverart";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (isSpotifyId(id)) {
    const artist = await getSpotifyArtist(id).catch(() => null);
    return { title: artist ? artist.name : "Artist" };
  }
  const artist = await lookupArtist(id).catch(() => null);
  return { title: artist ? artist.name : "Artist" };
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (isSpotifyId(id)) {
    return <SpotifyArtistPage id={id} />;
  }
  return <MbArtistPage id={id} />;
}

/* -------------------------------------------------------------------------- */
/* Spotify artist page                                                         */
/* -------------------------------------------------------------------------- */

async function SpotifyArtistPage({ id }: { id: string }) {
  let artist;
  try {
    artist = await getSpotifyArtist(id);
  } catch (error) {
    if (error instanceof SpotifyError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl leading-tight font-bold">{artist.name}</h1>
        {artist.genres.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {artist.genres.map((genre) => (
              <li
                key={genre}
                className="border-ink-700 text-mist-300 rounded-full border px-3 py-1 text-xs"
              >
                {genre}
              </li>
            ))}
          </ul>
        )}
      </header>

      <Suspense fallback={<DiscographySkeleton />}>
        <SpotifyDiscography artistId={id} />
      </Suspense>
    </div>
  );
}

const SPOTIFY_SECTION_ORDER = ["Albums", "Singles & EPs", "Compilations"] as const;
type SpotifySection = (typeof SPOTIFY_SECTION_ORDER)[number];

function spotifySectionOf(album: SpotifyAlbumResult): SpotifySection {
  if (album.albumType === "compilation") return "Compilations";
  if (album.albumType === "single") return "Singles & EPs";
  return "Albums";
}

async function SpotifyDiscography({ artistId }: { artistId: string }) {
  let albums;
  let albumsError: string | null = null;
  try {
    albums = await getSpotifyArtistAlbums(artistId);
  } catch (err) {
    albumsError = err instanceof Error ? err.message : String(err);
    return (
      <div
        role="alert"
        className="surface border-red-500/30 bg-red-500/5 px-6 py-10 text-center"
      >
        <p className="text-sm text-red-300">
          Couldn&apos;t load albums right now. Try refreshing the page.
        </p>
        {albumsError && (
          <p className="text-mist-500 mt-2 font-mono text-xs">{albumsError}</p>
        )}
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <p className="text-mist-400 text-sm">No releases found for this artist.</p>
    );
  }

  const ratings = await ratingsFor(albums.map((a) => a.spotifyId));

  const sections = new Map<SpotifySection, SpotifyAlbumResult[]>();
  for (const album of albums) {
    const section = spotifySectionOf(album);
    const bucket = sections.get(section) ?? [];
    bucket.push(album);
    sections.set(section, bucket);
  }

  return (
    <div className="space-y-10">
      {SPOTIFY_SECTION_ORDER.filter((s) => sections.has(s)).map((section) => {
        const releases = sections.get(section)!;
        return (
          <section key={section} className="space-y-4">
            <div className="border-ink-800 flex items-baseline justify-between border-b pb-2">
              <h2 className="text-mist-400 text-xs font-semibold tracking-wider uppercase">
                {section}
              </h2>
              <span className="text-mist-400 text-xs tabular-nums">
                {releases.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {releases.map((album, index) => (
                <AlbumCard
                  key={album.spotifyId}
                  href={`/album/${album.spotifyId}`}
                  title={album.title}
                  artist={album.artistName}
                  year={album.year}
                  coverUrl={album.artworkUrl}
                  rating={ratings.get(album.spotifyId) ?? null}
                  priority={section === "Albums" && index < 6}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MusicBrainz artist page (existing library albums)                          */
/* -------------------------------------------------------------------------- */

async function MbArtistPage({ id }: { id: string }) {
  let artist;
  try {
    artist = await lookupArtist(id);
  } catch (error) {
    if (
      error instanceof MusicBrainzError &&
      (error.status === 404 || error.status === 400)
    ) {
      notFound();
    }
    throw error;
  }

  const meta = [artist.type, artist.country, activeYears(artist)].filter(Boolean);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl leading-tight font-bold">{artist.name}</h1>
        {artist.disambiguation && (
          <p className="text-mist-300">{artist.disambiguation}</p>
        )}
        {meta.length > 0 && (
          <p className="text-mist-400 text-sm">{meta.join(" · ")}</p>
        )}
        {artist.genres.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {artist.genres.map((genre) => (
              <li
                key={genre}
                className="border-ink-700 text-mist-300 rounded-full border px-3 py-1 text-xs"
              >
                {genre}
              </li>
            ))}
          </ul>
        )}
      </header>

      <Suspense fallback={<DiscographySkeleton />}>
        <MbDiscography artistMbid={artist.mbid} />
      </Suspense>

      <p className="text-mist-400 text-xs">
        <a
          href={`https://musicbrainz.org/artist/${artist.mbid}`}
          className="hover:text-mist-100 underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          View on MusicBrainz
        </a>
      </p>
    </div>
  );
}

const MB_SECTION_ORDER: ReleaseSection[] = [
  "Albums",
  "EPs",
  "Live",
  "Compilations",
  "Other",
];

async function MbDiscography({ artistMbid }: { artistMbid: string }) {
  const { releaseGroups, total } = await getArtistReleaseGroups(artistMbid);

  if (releaseGroups.length === 0) {
    return (
      <p className="text-mist-400 text-sm">
        MusicBrainz has no releases listed for this artist.
      </p>
    );
  }

  const ratings = await ratingsFor(releaseGroups.map((r) => r.mbid));

  const sections = new Map<ReleaseSection, AlbumSearchResult[]>();
  for (const release of releaseGroups) {
    const section = sectionOf(release);
    const bucket = sections.get(section) ?? [];
    bucket.push(release);
    sections.set(section, bucket);
  }

  return (
    <div className="space-y-10">
      {MB_SECTION_ORDER.filter((section) => sections.has(section)).map((section) => {
        const releases = sections.get(section)!;
        return (
          <section key={section} className="space-y-4">
            <div className="border-ink-800 flex items-baseline justify-between border-b pb-2">
              <h2 className="text-mist-400 text-xs font-semibold tracking-wider uppercase">
                {section}
              </h2>
              <span className="text-mist-400 text-xs tabular-nums">
                {releases.length}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
              {releases.map((release, index) => (
                <AlbumCard
                  key={release.mbid}
                  href={`/album/${release.mbid}`}
                  title={release.title}
                  artist={release.artistName}
                  year={release.year}
                  coverUrl={coverArtUrlForMbid(release.mbid, 500)}
                  rating={ratings.get(release.mbid) ?? null}
                  priority={section === "Albums" && index < 6}
                />
              ))}
            </div>
          </section>
        );
      })}

      {total > releaseGroups.length && (
        <p className="text-mist-400 text-xs">
          Showing {releaseGroups.length} of {total} releases.
        </p>
      )}
    </div>
  );
}

function DiscographySkeleton() {
  return (
    <section className="space-y-4" aria-live="polite">
      <p className="text-mist-400 text-xs tracking-wider uppercase">
        Loading releases…
      </p>
      <AlbumGridSkeleton />
    </section>
  );
}

async function ratingsFor(ids: string[]): Promise<Map<string, number | null>> {
  if (ids.length === 0) return new Map();

  try {
    const user = await getOptionalCurrentUser();
    if (!user) return new Map();

    const rows = await db
      .select({ albumId: schema.entries.albumId, rating: schema.entries.rating })
      .from(schema.entries)
      .where(
        and(eq(schema.entries.userId, user.id), inArray(schema.entries.albumId, ids)),
      );

    return new Map(rows.map((row) => [row.albumId, row.rating]));
  } catch {
    return new Map();
  }
}
