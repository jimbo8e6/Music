import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AlbumCard } from "@/components/AlbumCard";
import { AlbumGridSkeleton } from "@/components/AlbumGridSkeleton";
import { activeYears } from "@/components/ArtistCard";
import { BackButton } from "@/components/BackButton";
import {
  MusicBrainzError,
  getArtistReleaseGroups,
  lookupArtist,
  sectionOf,
  type AlbumSearchResult,
  type ReleaseSection,
} from "@/lib/musicbrainz";
import {
  DeezerError,
  getDeezerAlbum,
  getDeezerArtist,
  getDeezerArtistAlbums,
  isDeezerAlbumId,
  type DeezerAlbumResult,
  type DeezerArtistResult,
} from "@/lib/deezer";
import { coverArtUrlForMbid } from "@/lib/coverart";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (isDeezerAlbumId(id)) {
    const artist = await getDeezerArtist(id).catch(() => null);
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

  if (isDeezerAlbumId(id)) {
    return <DeezerArtistPage id={id} />;
  }
  return <MbArtistPage id={id} />;
}

/* -------------------------------------------------------------------------- */
/* Deezer artist page                                                          */
/* -------------------------------------------------------------------------- */

async function DeezerArtistPage({ id }: { id: string }) {
  let artist;
  try {
    artist = await getDeezerArtist(id);
  } catch (error) {
    if (error instanceof DeezerError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-8">
      <BackButton />
      <header className="space-y-2">
        <h1 className="text-3xl leading-tight font-bold">{artist.name}</h1>
      </header>

      <Suspense fallback={<DiscographySkeleton />}>
        <DeezerDiscography artistId={id} artistName={artist.name} />
      </Suspense>
    </div>
  );
}

const DEEZER_SECTION_ORDER = ["Albums", "Live", "Singles & EPs", "Compilations"] as const;
type DeezerSection = (typeof DEEZER_SECTION_ORDER)[number];

const LIVE_TITLE_RE = /\blive\b|concert|in concert|unplugged|acoustic session/i;

function deezerSectionOf(album: DeezerAlbumResult): DeezerSection {
  if (album.albumType === "compilation") return "Compilations";
  if (album.albumType === "single" || album.albumType === "ep") return "Singles & EPs";
  if (album.albumType === "live" || LIVE_TITLE_RE.test(album.title)) return "Live";
  return "Albums";
}

async function DeezerDiscography({ artistId, artistName }: { artistId: string; artistName: string }) {
  let albums;
  try {
    albums = await getDeezerArtistAlbums(artistId, artistName);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return (
      <div
        role="alert"
        className="surface border-red-500/30 bg-red-500/5 px-6 py-10 text-center"
      >
        <p className="text-sm text-red-300">
          Couldn&apos;t load albums right now. Try refreshing the page.
        </p>
        <p className="text-mist-500 mt-2 font-mono text-xs">{message}</p>
      </div>
    );
  }

  if (albums.length === 0) {
    return (
      <p className="text-mist-400 text-sm">No releases found for this artist.</p>
    );
  }

  const sorted = [...albums].sort((a, b) =>
    (b.releaseDate ?? "0000") > (a.releaseDate ?? "0000") ? 1 : -1,
  );

  const sections = new Map<DeezerSection, DeezerAlbumResult[]>();
  for (const album of sorted) {
    const section = deezerSectionOf(album);
    const bucket = sections.get(section) ?? [];
    bucket.push(album);
    sections.set(section, bucket);
  }

  // If there are no studio albums, check whether the releases on this profile
  // are actually attributed to a different Deezer artist (e.g. Suede (6365)
  // carries a few singles whose canonical artist is The London Suede (1203293)
  // due to a North American trademark dispute). Fetching the album detail
  // reveals the true artist ID, which we surface as a navigation hint.
  let relatedArtists: DeezerArtistResult[] = [];
  if (!sections.has("Albums")) {
    const firstRelease = DEEZER_SECTION_ORDER.flatMap((s) => sections.get(s) ?? []).at(0);
    if (firstRelease) {
      try {
        const detail = await getDeezerAlbum(firstRelease.deezerId);
        if (detail.artistDeezerId && detail.artistDeezerId !== artistId) {
          const canonical = await getDeezerArtist(detail.artistDeezerId);
          relatedArtists = [canonical];
        }
      } catch {
        // non-fatal — just don't show the hint
      }
    }
  }

  return (
    <div className="space-y-10">
      {DEEZER_SECTION_ORDER.filter((s) => sections.has(s)).map((section) => {
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
                  key={album.deezerId}
                  href={`/album/${album.deezerId}`}
                  title={album.title}
                  artist={album.artistName}
                  year={album.year}
                  coverUrl={album.artworkUrl}
                  priority={section === "Albums" && index < 6}
                />
              ))}
            </div>
          </section>
        );
      })}

      {relatedArtists.length > 0 && (
        <div className="border-ink-800 rounded-lg border p-4">
          <p className="text-mist-400 mb-3 text-sm">
            Not finding albums? This artist may also appear under a different name on Deezer:
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedArtists.map((a) => (
              <a
                key={a.deezerId}
                href={`/artist/${a.deezerId}`}
                className="bg-ink-800 hover:bg-ink-700 text-mist-200 rounded-md px-3 py-1.5 text-sm transition-colors"
              >
                {a.name} →
              </a>
            ))}
          </div>
        </div>
      )}
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
      <BackButton />
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

