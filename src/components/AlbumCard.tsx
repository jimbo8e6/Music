import Link from "next/link";

import { AlbumArt } from "@/components/AlbumArt";
import { Stars } from "@/components/Stars";

export interface AlbumCardProps {
  href: string;
  title: string;
  artist: string;
  year?: number | null;
  coverUrl: string | null;
  rating?: number | null;
  hasReview?: boolean;
  priority?: boolean;
}

/**
 * The unit the whole app is built from: artwork first, everything else small
 * and underneath. Titles stay visible rather than appearing on hover — hover
 * text doesn't exist on touch, and the grid has room for it.
 */
export function AlbumCard({
  href,
  title,
  artist,
  year,
  coverUrl,
  rating = null,
  hasReview = false,
  priority = false,
}: AlbumCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="ring-ink-800 group-hover:ring-accent-500/70 rounded-tile overflow-hidden shadow-lg shadow-black/40 ring-1 transition duration-150 group-hover:-translate-y-0.5">
        <AlbumArt
          src={coverUrl}
          title={title}
          artist={artist}
          priority={priority}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 210px"
        />
      </div>

      <div className="mt-2 space-y-0.5">
        <p className="group-hover:text-accent-400 truncate text-sm font-medium transition-colors">
          {title}
        </p>
        <p className="text-mist-400 truncate text-xs">
          {artist}
          {year ? ` · ${year}` : ""}
        </p>

        {(rating !== null || hasReview) && (
          <div className="flex items-center gap-2 pt-0.5">
            {rating !== null && <Stars rating={rating} size="sm" />}
            {hasReview && (
              <span className="text-mist-400 text-xs" title="You wrote a review">
                ✎
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
