import { AlbumCard } from "@/components/AlbumCard";
import { EmptyState } from "@/components/EmptyState";
import { coverArtUrl } from "@/lib/coverart";
import { getWatchlist } from "@/lib/queries";

export const metadata = { title: "Listen later" };
export const dynamic = "force-dynamic";

export default function WatchlistPage() {
  const albums = getWatchlist();

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">
        Listen later
        <span className="text-mist-400 ml-2 text-sm font-normal tabular-nums">
          {albums.length}
        </span>
      </h1>

      {albums.length === 0 ? (
        <EmptyState
          title="Your list is empty"
          body="Found something you want to hear but haven't yet? Add it here from the album page and it'll wait for you."
          actionHref="/search"
          actionLabel="Find an album"
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {albums.map((album, index) => (
            <AlbumCard
              key={album.id}
              href={`/album/${album.id}`}
              title={album.title}
              artist={album.artistName}
              year={album.year}
              coverUrl={coverArtUrl(album, 500)}
              priority={index < 6}
            />
          ))}
        </div>
      )}
    </div>
  );
}
