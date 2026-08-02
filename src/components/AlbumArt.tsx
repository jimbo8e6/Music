"use client";

import Image from "next/image";
import { useState } from "react";

import { hueFromString, initialsFor } from "@/lib/format";

/**
 * Square album artwork with a graceful miss.
 *
 * Cover Art Archive 404s for release-groups nobody has uploaded art for, and
 * the request goes out from the browser, so the only reliable signal is the
 * image's own error event — hence the client component.
 */
export function AlbumArt({
  src,
  title,
  artist,
  sizes = "(max-width: 640px) 45vw, 200px",
  priority = false,
  className = "",
}: {
  src: string | null;
  title: string;
  artist: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <div
      className={`bg-ink-850 relative aspect-square overflow-hidden ${className}`}
    >
      {showFallback ? (
        <Fallback title={title} artist={artist} />
      ) : (
        <Image
          src={src}
          alt={`${title} by ${artist}`}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZED_IMAGES === "1"}
          className="object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/** Deterministic colour-block tile so a missing cover still looks intentional. */
function Fallback({ title, artist }: { title: string; artist: string }) {
  const hue = hueFromString(`${artist}${title}`);

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{
        background: `linear-gradient(145deg, hsl(${hue} 32% 26%), hsl(${(hue + 40) % 360} 28% 14%))`,
      }}
    >
      <span className="text-2xl font-semibold tracking-wide text-white/70">
        {initialsFor(title)}
      </span>
    </div>
  );
}
