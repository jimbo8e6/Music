import Link from "next/link";

import { AlbumArt } from "@/components/AlbumArt";
import { ReviewForm } from "@/components/ReviewForm";
import { coverArtUrl } from "@/lib/coverart";
import { loadAlbumOrNotFound } from "@/lib/loadAlbum";
import { getEntryForAlbum } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function LogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await loadAlbumOrNotFound(id);

  const entry = await getEntryForAlbum(album.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/album/${album.id}`}
        className="text-mist-400 hover:text-mist-100 inline-block text-sm transition-colors"
      >
        ← Back to album
      </Link>

      <div className="flex items-center gap-4">
        <div className="ring-ink-800 rounded-tile w-20 shrink-0 overflow-hidden ring-1">
          <AlbumArt
            src={coverArtUrl(album, 250)}
            title={album.title}
            artist={album.artistName}
            sizes="80px"
          />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold">{album.title}</h1>
          <p className="text-mist-400 truncate text-sm">
            {album.artistName}
            {album.year ? ` · ${album.year}` : ""}
          </p>
        </div>
      </div>

      <ReviewForm albumId={album.id} entry={entry} />
    </div>
  );
}
