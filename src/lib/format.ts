/** Half-star rating helpers. Ratings are stored as integers 1–10. */

export const MAX_RATING = 10;

export function ratingToStars(rating: number): number {
  return rating / 2;
}

export function starsToRating(stars: number): number {
  return Math.round(stars * 2);
}

/** "3.5" — the label next to a star row. */
export function formatStars(rating: number | null): string {
  if (rating === null) return "—";
  const stars = ratingToStars(rating);
  return Number.isInteger(stars) ? String(stars) : stars.toFixed(1);
}

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  // MusicBrainz dates can be YYYY, YYYY-MM or YYYY-MM-DD.
  const parts = value.split("-");
  if (parts.length === 1) return parts[0];

  const date = new Date(`${value}${parts.length === 2 ? "-01" : ""}`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: parts.length === 3 ? "numeric" : undefined,
    month: "long",
    year: "numeric",
  });
}

export function formatRelative(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];

  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  for (const [unit, secondsPerUnit] of units) {
    if (seconds >= secondsPerUnit) {
      return rtf.format(-Math.floor(seconds / secondsPerUnit), unit);
    }
  }
  return "just now";
}

/** Deterministic hue per album, for the placeholder tile when art is missing. */
export function hueFromString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

export function initialsFor(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/** "3:47" — track length from milliseconds, or an em dash when unknown. */
export function formatDuration(ms: number | null): string {
  if (!ms || ms < 0) return "—";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** "42 min" — total running time, for the tracklist footer. */
export function formatTotalDuration(msValues: (number | null)[]): string | null {
  const total = msValues.reduce<number>((sum, ms) => sum + (ms ?? 0), 0);
  if (!total) return null;
  const minutes = Math.round(total / 60000);
  return `${minutes} min`;
}
