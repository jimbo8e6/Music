/**
 * Placeholder grid shown while MusicBrainz answers. It matches the real grid's
 * shape so results drop into place rather than shoving the page around.
 */
export function AlbumGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6"
      aria-hidden
    >
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="animate-pulse">
          <div className="bg-ink-850 rounded-tile aspect-square" />
          <div className="mt-2 space-y-1.5">
            <div className="bg-ink-850 h-3 w-4/5 rounded" />
            <div className="bg-ink-850 h-2.5 w-3/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
