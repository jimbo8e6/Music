import Link from "next/link";
import { Suspense } from "react";

import { AlbumSleeve } from "@/components/AlbumSleeve";
import { OwnedFormatsButton } from "@/components/OwnedFormatsButton";
import { PlayLinks } from "@/components/PlayLinks";
import { Stars } from "@/components/Stars";
import { deleteEntry, toggleWatchlist } from "@/lib/actions";
import { backCoverUrl, coverArtUrl } from "@/lib/coverart";
import { formatDate, formatRelative } from "@/lib/format";
import { loadAlbumOrNotFound } from "@/lib/loadAlbum";
import {
  getEntryForAlbum,
  getExternalLinks,
  getOrFetchAlbum,
  getOwnedFormats,
  getTrackCount,
  isOnWatchlist,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

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

  const [entry, onWatchlist, ownedFormats] = await Promise.all([
    getEntryForAlbum(album.id),
    isOnWatchlist(album.id),
    getOwnedFormats(album.id),
  ]);

  // The tracklist needs a second MusicBrainz request, which the rate limiter
  // has to space a second behind the first. It streams in below instead of
  // holding up the whole page.
  const meta = [
    album.primaryType,
    ...(album.secondaryTypes ?? []),
    formatDate(album.releaseDate),
  ].filter(Boolean);

  return (
    <article className="space-y-10">
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

          <div className="flex flex-col gap-2">
            <Link href={`/album/${album.id}/log`} className="btn btn-primary w-full">
              {entry ? "Edit your review" : "Rate or review"}
            </Link>

            {!entry && (
              <form action={toggleWatchlist}>
                <input type="hidden" name="albumId" value={album.id} />
                <button type="submit" className="btn btn-ghost w-full">
                  {onWatchlist ? "Remove from listen later" : "Listen later"}
                </button>
              </form>
            )}

            <OwnedFormatsButton albumId={album.id} initialFormats={ownedFormats} />

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

          {album.genres && album.genres.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {album.genres.map((genre) => (
                <li
                  key={genre}
                  className="border-ink-700 text-mist-300 rounded-full border px-3 py-1 text-xs"
                >
                  {genre}
                </li>
              ))}
            </ul>
          )}

          {entry ? (
            <section className="surface space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Stars rating={entry.rating} size="lg" showValue />
                {entry.isFavorite && (
                  <span className="text-star text-sm" title="Favourite">
                    ♥ Favourite
                  </span>
                )}
                <span className="text-mist-400 ml-auto text-xs">
                  {entry.listenedOn
                    ? `Listened ${formatDate(entry.listenedOn)}`
                    : `Logged ${formatRelative(entry.createdAt)}`}
                </span>
              </div>

              {entry.reviewTitle && (
                <h2 className="text-lg font-semibold">{entry.reviewTitle}</h2>
              )}

              {entry.reviewText && (
                <div className="text-mist-100 space-y-3 leading-relaxed whitespace-pre-wrap">
                  {entry.reviewText}
                </div>
              )}

              <div className="border-ink-800 flex items-center gap-4 border-t pt-3">
                <Link
                  href={`/album/${album.id}/log`}
                  className="text-mist-400 hover:text-accent-400 text-xs transition-colors"
                >
                  Edit
                </Link>
                <form action={deleteEntry}>
                  <input type="hidden" name="albumId" value={album.id} />
                  <button
                    type="submit"
                    className="text-mist-400 text-xs transition-colors hover:text-red-400"
                  >
                    Remove from library
                  </button>
                </form>
              </div>
            </section>
          ) : (
            <section className="border-ink-800 text-mist-400 rounded-lg border border-dashed px-5 py-8 text-sm">
              You haven&apos;t logged this one yet.
            </section>
          )}

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
    </article>
  );
}

/** Renders nothing at all when MusicBrainz has no tracklist for the release. */
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
