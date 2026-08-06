import { formatStars } from "@/lib/format";
import type { AlbumStats } from "@/lib/queries";

export function RatingGraph({ stats }: { stats: AlbumStats }) {
  const { totalRatings, average, distribution } = stats;

  if (totalRatings === 0) return null;

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        {average !== null && (
          <span className="text-2xl font-bold">{(average / 2).toFixed(1)}</span>
        )}
        <span className="text-mist-400 text-sm">
          {totalRatings} {totalRatings === 1 ? "rating" : "ratings"}
        </span>
      </div>

      {/* Bars: rating 10 (5★) at top, rating 1 (0.5★) at bottom */}
      <div className="space-y-1">
        {[...distribution].reverse().map(({ rating, count }) => (
          <div key={rating} className="flex items-center gap-2">
            <span className="text-mist-500 w-6 text-right text-xs tabular-nums">
              {formatStars(rating)}
            </span>
            <div className="bg-ink-800 h-3 flex-1 overflow-hidden rounded-sm">
              <div
                className="bg-accent-500 h-full rounded-sm transition-all"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            {count > 0 && (
              <span className="text-mist-500 w-5 text-xs tabular-nums">{count}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
