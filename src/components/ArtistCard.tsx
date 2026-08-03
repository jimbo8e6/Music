import Image from "next/image";
import Link from "next/link";

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

export interface ArtistCardProps {
  href: string;
  name: string;
  /** Spotify CDN or similar — shown as a circular photo. */
  imageUrl?: string | null;
  /** Disambiguation text or first genre. */
  tagline?: string | null;
  /** Formatted meta string, e.g. "Group · GB · 1991–" or "indie rock · pop". */
  meta?: string | null;
}

export function ArtistCard({ href, name, imageUrl, tagline, meta }: ArtistCardProps) {
  const hue = hueFromString(name);

  return (
    <Link
      href={href}
      className="surface hover:border-ink-700 group flex items-center gap-4 p-3 transition-colors"
    >
      {imageUrl ? (
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
          <Image
            src={imageUrl}
            alt={name}
            width={48}
            height={48}
            className="h-full w-full object-cover"
            unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZED_IMAGES === "1"}
          />
        </div>
      ) : (
        <span
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-semibold text-white/75"
          style={{
            background: `linear-gradient(145deg, hsl(${hue} 32% 30%), hsl(${(hue + 40) % 360} 28% 16%))`,
          }}
        >
          {initialsFor(name)}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="group-hover:text-accent-400 block truncate font-medium transition-colors">
          {name}
        </span>
        {tagline && (
          <span className="text-mist-300 block truncate text-xs">{tagline}</span>
        )}
        {meta && (
          <span className="text-mist-400 block truncate text-xs">{meta}</span>
        )}
      </span>

      <span className="text-mist-400 group-hover:text-accent-400 shrink-0 text-sm transition-colors">
        →
      </span>
    </Link>
  );
}
