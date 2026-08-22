import Link from "next/link";
import { Suspense } from "react";

import { AlbumSleeve } from "@/components/AlbumSleeve";
import { BackButton } from "@/components/BackButton";
import { CommunityReviewsClient } from "@/components/CommunityReviewsClient";
import { PlayLinks } from "@/components/PlayLinks";
import { RatingGraph } from "@/components/RatingGraph";
import { UserAlbumActions } from "@/components/UserAlbumActions";
import { UserAlbumProvider } from "@/components/UserAlbumContext";
import { UserEntrySection } from "@/components/UserEntrySection";
import { backCoverUrl, coverArtUrl } from "@/lib/coverart";
import { formatDate, formatStars } from "@/lib/format";
import { loadAlbumOrNotFound } from "@/lib/loadAlbum";
import { getAlbumStats, getExternalLinks, getOrFetchAlbum, getTrackCount } from "@/lib/queries";

export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getOrFetchAlbum(id).catch(() => null);
  if (!album) return { title: "Album" };
  return { title: `${album.title} — ${album.artistName}` };
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await loadAlbumOrNotFound(id);
  const albumStats = await getAlbumStats(album.id);

  const meta = [
    album.primaryType,
    ...(album.secondaryTypes ?? []),
    formatDate(album.releaseDate),
  ].filter(Boolean);

  return (
    <article className="space-y-10">
      <BackButton />
      <UserAlbumProvider albumId={album.id}>
        <div className="grid gap-8 md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-4">
            <AlbumSleeve
              albumId={album.id}
              frontUrl={coverArtUrl(album, 1200)}
              backUrl={backCoverUrl(album, 1200)}
              title={album.title}
              artist={album.artistName}
              trackCount={album.trackCount}
            />

            <UserAlbumActions albumId={album.id} />

            {/* Search links render immediately; the exact album link replaces
                them if MusicBrainz has one. Same shape either way, so nothing
                moves when it resolves. */}
            <Suspense
              fallback={
                <PlayLinks links={{}} title={album.title} artist={album.artistName} />
              }
            >
              <ResolvedPlayLinks
                albumId={album.id}
                title={album.title}
                artist={album.artistName}
              />
            </Suspense>
          </div>

          <div className="space-y-6">
            <header className="space-y-2">
              <h1 className="text-3xl leading-tight font-bold">{album.title}</h1>
              {album.artistSpotifyId || album.artistMbid ? (
                <Link
                  href={`/artist/${album.artistSpotifyId ?? album.artistMbid}`}
                  className="text-mist-300 hover:text-accent-400 inline-block text-lg transition-colors"
                >
                  {album.artistName}
                </Link>
              ) : (
                <p className="text-mist-300 text-lg">{album.artistName}</p>
              )}
              {meta.length > 0 && (
                <p className="text-mist-400 text-sm">
                  {meta.join(" · ")}
                  <Suspense fallback={null}>
                    <TrackCount albumId={album.id} />
                  </Suspense>
                </p>
              )}
            </header>

            {(album.genres && album.genres.length > 0 || albumStats.totalRatings > 0) && (
              <div className="flex flex-wrap items-center gap-2">
                {album.genres?.map((genre) => (
                  <span
                    key={genre}
                    className="border-ink-700 text-mist-300 rounded-full border px-3 py-1 text-xs"
                  >
                    {genre}
                  </span>
                ))}
                {albumStats.totalRatings > 0 && (
                  <a
                    href="#community-ratings"
                    className="border-ink-700 text-star hover:border-ink-600 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {formatStars(albumStats.average)}
                    <span className="text-mist-500">({albumStats.totalRatings})</span>
                  </a>
                )}
              </div>
            )}

            <UserEntrySection albumId={album.id} />

            {album.mbid && !album.artistSpotifyId && (
              <p className="text-mist-400 text-xs">
                <a
                  href={`https://musicbrainz.org/release-group/${album.mbid}`}
                  className="hover:text-mist-100 underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  View on MusicBrainz
                </a>
              </p>
            )}
          </div>
        </div>

        {/* Community stats + reviews below the main grid */}
        {albumStats.totalRatings > 0 && (
          <section id="community-ratings" className="border-ink-800 space-y-4 border-t pt-6">
            <h2 className="text-mist-400 text-xs font-semibold uppercase tracking-wider">
              Community ratings
            </h2>
            <RatingGraph stats={albumStats} />
          </section>
        )}

        <CommunityReviewsClient albumId={album.id} />
      </UserAlbumProvider>
    </article>
  );
}

async function TrackCount({ albumId }: { albumId: string }) {
  const count = await getTrackCount(albumId);
  if (!count) return null;
  return <> · {count} tracks</>;
}

async function ResolvedPlayLinks({
  albumId,
  title,
  artist,
}: {
  albumId: string;
  title: string;
  artist: string;
}) {
  const links = await getExternalLinks(albumId);
  return <PlayLinks links={links} title={title} artist={artist} />;
}
