import { MAX_RATING, formatStars } from "@/lib/format";

const SIZES = {
  sm: "text-xs",
  md: "text-base",
  lg: "text-2xl",
} as const;

/**
 * Read-only star display. Two stacked rows — grey underneath, gold on top
 * clipped to the rating — which renders half stars exactly without needing
 * half-star glyphs.
 */
export function Stars({
  rating,
  size = "md",
  showValue = false,
}: {
  rating: number | null;
  size?: keyof typeof SIZES;
  showValue?: boolean;
}) {
  if (rating === null) {
    return <span className="text-mist-400 text-sm">Not rated</span>;
  }

  const percent = (rating / MAX_RATING) * 100;

  return (
    <span
      className="inline-flex items-center gap-2"
      title={`${formatStars(rating)} out of 5`}
    >
      <span className={`relative inline-block leading-none ${SIZES[size]}`} aria-hidden>
        <span className="text-ink-600 tracking-[0.1em]">★★★★★</span>
        <span
          className="text-star absolute inset-0 overflow-hidden tracking-[0.1em]"
          style={{ width: `${percent}%` }}
        >
          ★★★★★
        </span>
      </span>
      {showValue && (
        <span className="text-mist-300 text-sm font-medium tabular-nums">
          {formatStars(rating)}
        </span>
      )}
      <span className="sr-only">{formatStars(rating)} out of 5 stars</span>
    </span>
  );
}
