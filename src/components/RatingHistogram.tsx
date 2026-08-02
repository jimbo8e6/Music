import { formatStars } from "@/lib/format";

/** Ten bars, half a star each — the shape of your taste at a glance. */
export function RatingHistogram({ distribution }: { distribution: number[] }) {
  const peak = Math.max(1, ...distribution);

  return (
    <div className="surface p-4">
      {/* The row stretches its children so the bars' percentage heights have a
          definite height to resolve against; each column then pushes its bar
          to the baseline. Peak tops out at 92% to leave room for the label. */}
      <div className="flex h-28 gap-1.5">
        {distribution.map((total, index) => {
          const rating = index + 1;

          return (
            <div
              key={rating}
              className="group flex flex-1 flex-col justify-end"
              title={`${formatStars(rating)} stars: ${total}`}
            >
              <div
                className="bg-accent-500/70 group-hover:bg-accent-400 relative w-full rounded-sm transition-colors"
                style={{ height: `${total === 0 ? 2 : (total / peak) * 92}%` }}
              >
                <span className="text-mist-300 absolute inset-x-0 bottom-full pb-1 text-center text-[10px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                  {total}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-mist-400 mt-2 flex justify-between text-xs">
        <span>★ 0.5</span>
        <span>★★★★★ 5</span>
      </div>
    </div>
  );
}
