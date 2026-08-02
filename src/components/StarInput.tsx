"use client";

import { useState } from "react";

import { MAX_RATING, formatStars } from "@/lib/format";

/**
 * Half-star picker. Each star is two hit targets (left half / right half), so
 * 3.5 is a click rather than a drag. Keyboard users get a real slider via the
 * arrow-key handlers on the group.
 */
export function StarInput({
  name = "rating",
  defaultValue = null,
}: {
  name?: string;
  defaultValue?: number | null;
}) {
  const [rating, setRating] = useState<number | null>(defaultValue);
  const [hover, setHover] = useState<number | null>(null);

  const shown = hover ?? rating ?? 0;

  function nudge(delta: number) {
    setRating((current) => {
      const next = (current ?? 0) + delta;
      if (next <= 0) return null;
      return Math.min(MAX_RATING, next);
    });
  }

  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name={name} value={rating ?? ""} />

      <div
        role="slider"
        tabIndex={0}
        aria-label="Rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={rating ? rating / 2 : 0}
        aria-valuetext={rating ? `${formatStars(rating)} stars` : "Not rated"}
        className="relative flex cursor-pointer select-none"
        onMouseLeave={() => setHover(null)}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            nudge(1);
          } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            nudge(-1);
          } else if (event.key === "Home") {
            event.preventDefault();
            setRating(null);
          } else if (event.key === "End") {
            event.preventDefault();
            setRating(MAX_RATING);
          }
        }}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = (index + 1) * 2;
          const fill = Math.min(1, Math.max(0, (shown - starValue + 2) / 2));

          return (
            <span key={index} className="relative block text-3xl leading-none">
              <span className="text-ink-600">★</span>
              <span
                className="text-star absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
                aria-hidden
              >
                ★
              </span>

              <button
                type="button"
                aria-label={`${(starValue - 1) / 2} stars`}
                className="absolute inset-y-0 left-0 w-1/2"
                onMouseEnter={() => setHover(starValue - 1)}
                onClick={() => setRating(starValue - 1)}
              />
              <button
                type="button"
                aria-label={`${starValue / 2} stars`}
                className="absolute inset-y-0 right-0 w-1/2"
                onMouseEnter={() => setHover(starValue)}
                onClick={() => setRating(starValue)}
              />
            </span>
          );
        })}
      </div>

      <span className="text-mist-300 w-10 text-sm tabular-nums">
        {rating ? formatStars(rating) : "—"}
      </span>

      {rating !== null && (
        <button
          type="button"
          onClick={() => setRating(null)}
          className="text-mist-400 hover:text-mist-100 text-xs underline underline-offset-2"
        >
          Clear
        </button>
      )}
    </div>
  );
}
