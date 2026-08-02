import Link from "next/link";

import type { ArtistSearchResult } from "@/lib/musicbrainz";
import { hueFromString, initialsFor } from "@/lib/format";

/** Years active, or the founding year alone for anyone still going. */
export function activeYears(artist: {
  beganYear: number | null;
  endedYear: number | null;
}): string | null {
  if (!artist.beganYear) return null;
  return artist.endedYear
    ? `${artist.beganYear}–${artist.endedYear}`
    : `${artist.beganYear}–`;
}

export function ArtistCard({ artist }: { artist: ArtistSearchResult }) {
  const hue = hueFromString(artist.name);
  const meta = [artist.type, artist.country, activeYears(artist)].filter(Boolean);

  return (
    <Link
      href={`/artist/${artist.mbid}`}
      className="surface hover:border-ink-700 group flex items-center gap-4 p-3 transition-colors"
    >
      <span
        aria-hidden
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white/75"
        style={{
          background: `linear-gradient(145deg, hsl(${hue} 32% 30%), hsl(${(hue + 40) % 360} 28% 16%))`,
        }}
      >
        {initialsFor(artist.name)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="group-hover:text-accent-400 block truncate font-medium transition-colors">
          {artist.name}
        </span>
        {artist.disambiguation && (
          <span className="text-mist-300 block truncate text-xs">
            {artist.disambiguation}
          </span>
        )}
        {meta.length > 0 && (
          <span className="text-mist-400 block truncate text-xs">
            {meta.join(" · ")}
          </span>
        )}
      </span>

      <span className="text-mist-400 group-hover:text-accent-400 shrink-0 text-sm transition-colors">
        →
      </span>
    </Link>
  );
}
