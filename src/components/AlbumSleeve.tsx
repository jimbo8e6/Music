"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { AlbumArt } from "@/components/AlbumArt";
import { formatDuration, formatTotalDuration } from "@/lib/format";

interface Track {
  position: number;
  title: string;
  lengthMs: number | null;
  medium: number;
}

type Load = { state: "idle" | "loading" | "done" | "error"; tracks: Track[] };

/**
 * The album cover, turned over.
 *
 * The back of a sleeve is a real photograph when someone has uploaded one, and
 * a tracklist when they haven't — which is most of the time, since Cover Art
 * Archive holds far more fronts than backs. Both are the same gesture, so the
 * card shows whichever it has.
 *
 * Nothing is fetched until the first flip: the tracklist costs a MusicBrainz
 * request, and loading it with every album page would slow down the common case.
 */
export function AlbumSleeve({
  albumId,
  frontUrl,
  backUrl,
  title,
  artist,
  trackCount,
}: {
  albumId: string;
  frontUrl: string | null;
  backUrl: string | null;
  title: string;
  artist: string;
  /** Known already? Then we can label the button before anything is fetched. */
  trackCount: number | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const [backFailed, setBackFailed] = useState(false);
  const [load, setLoad] = useState<Load>({ state: "idle", tracks: [] });

  const showBackImage = Boolean(backUrl) && !backFailed;
  const needsTracks = flipped && !showBackImage && load.state === "idle";

  const fetchTracks = useCallback(async () => {
    setLoad({ state: "loading", tracks: [] });
    try {
      const res = await fetch(`/api/albums/${albumId}/tracks`);
      const data = (await res.json()) as { tracks?: Track[] };
      const tracks = data.tracks ?? [];
      setLoad({ state: tracks.length ? "done" : "error", tracks });
    } catch {
      setLoad({ state: "error", tracks: [] });
    }
  }, [albumId]);

  useEffect(() => {
    if (needsTracks) void fetchTracks();
  }, [needsTracks, fetchTracks]);

  return (
    <div className="space-y-2">
      <div
        className="sleeve ring-ink-800 rounded-tile relative aspect-square w-full shadow-2xl shadow-black/50 ring-1"
        data-flipped={flipped}
      >
        <div className="sleeve-inner">
          <button
            type="button"
            onClick={() => setFlipped(true)}
            className="sleeve-face cursor-pointer"
            aria-label="Show tracklist"
          >
            <AlbumArt
              src={frontUrl}
              title={title}
              artist={artist}
              sizes="(max-width: 768px) 100vw, 320px"
              priority
            />
          </button>

          <button
            type="button"
            onClick={() => setFlipped(false)}
            className="sleeve-face sleeve-back bg-ink-900 cursor-pointer"
            aria-label="Show front cover"
          >
            {showBackImage ? (
              <Image
                src={backUrl!}
                alt={`Back cover of ${title} by ${artist}`}
                fill
                sizes="(max-width: 768px) 100vw, 320px"
                unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZED_IMAGES === "1"}
                className="object-cover"
                onError={() => setBackFailed(true)}
              />
            ) : (
              <TrackPanel load={load} />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        className="text-mist-400 hover:text-accent-400 w-full text-center text-xs transition-colors"
      >
        {flipped
          ? "← Front cover"
          : showBackImage
            ? "Back cover →"
            : trackCount
              ? `Tracklist (${trackCount}) →`
              : "Tracklist →"}
      </button>
    </div>
  );
}

function TrackPanel({ load }: { load: Load }) {
  if (load.state === "loading" || load.state === "idle") {
    return (
      <div className="text-mist-400 flex h-full items-center justify-center text-xs">
        Loading tracklist…
      </div>
    );
  }

  if (load.state === "error" || load.tracks.length === 0) {
    return (
      <div className="text-mist-400 flex h-full items-center justify-center px-6 text-center text-xs">
        No tracklist available for this release.
      </div>
    );
  }

  const multiDisc = new Set(load.tracks.map((t) => t.medium)).size > 1;
  const total = formatTotalDuration(load.tracks.map((t) => t.lengthMs));

  return (
    <div className="flex h-full flex-col p-3">
      {/* Long tracklists scroll; the fade is the only hint that they do. */}
      <div className="relative min-h-0 flex-1">
        <ol className="h-full overflow-y-auto pr-1 text-xs">
          {load.tracks.map((track, index) => {
            const first = index === 0 || load.tracks[index - 1].medium !== track.medium;
            return (
              <li key={`${track.medium}-${track.position}-${index}`}>
                {multiDisc && first && (
                  <p className="text-mist-400 pt-2 pb-1 text-[10px] tracking-wider uppercase">
                    Disc {track.medium}
                  </p>
                )}
                <span className="border-ink-800/70 flex items-baseline gap-2 border-b py-1 last:border-0">
                  <span className="text-mist-400 w-5 shrink-0 text-right tabular-nums">
                    {track.position}
                  </span>
                  <span className="text-mist-100 min-w-0 flex-1 truncate" title={track.title}>
                    {track.title}
                  </span>
                  <span className="text-mist-400 shrink-0 tabular-nums">
                    {formatDuration(track.lengthMs)}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="from-ink-900 pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t to-transparent" />
      </div>

      {total && (
        <p className="text-mist-400 border-ink-800 mt-2 border-t pt-2 text-[10px] tracking-wider uppercase">
          {load.tracks.length} tracks · {total}
        </p>
      )}
    </div>
  );
}
