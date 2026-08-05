"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

import { setFavouriteAlbum, removeFavouriteAlbum } from "@/lib/actions";
import type { Album } from "@/db/schema";

interface SearchResult {
  deezerId: string;
  title: string;
  artistName: string;
  artworkUrl: string | null;
  year: number | null;
}

export function FavouriteAlbums({
  favourites,
  isOwner,
}: {
  favourites: (Album | null)[];
  isOwner: boolean;
}) {
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const hasFavourites = favourites.some(Boolean);
  if (!isOwner && !hasFavourites) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-mist-400 border-ink-800 border-b pb-2 text-xs font-semibold uppercase tracking-wider">
        Favourite Albums
      </h2>
      <div className="grid grid-cols-4 gap-3">
        {favourites.map((album, i) => (
          <Slot
            key={i}
            position={i + 1}
            album={album}
            isOwner={isOwner}
            isActive={activeSlot === i + 1}
            onOpen={() => setActiveSlot(i + 1)}
            onClose={() => setActiveSlot(null)}
          />
        ))}
      </div>

      {activeSlot !== null && (
        <SearchPanel
          position={activeSlot}
          onSelect={() => setActiveSlot(null)}
          onClose={() => setActiveSlot(null)}
        />
      )}
    </section>
  );
}

function Slot({
  position,
  album,
  isOwner,
  isActive,
  onOpen,
  onClose,
}: {
  position: number;
  album: Album | null;
  isOwner: boolean;
  isActive: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await removeFavouriteAlbum(position);
      onClose();
    });
  };

  if (!album) {
    if (!isOwner) {
      return <div className="bg-ink-850 aspect-square rounded-sm" />;
    }
    return (
      <button
        onClick={onOpen}
        className={`bg-ink-850 border-ink-700 hover:border-accent-500/60 hover:text-accent-400 text-mist-600 flex aspect-square w-full items-center justify-center rounded-sm border border-dashed transition-colors ${isActive ? "border-accent-500/60 text-accent-400" : ""}`}
      >
        <span className="text-2xl leading-none">+</span>
      </button>
    );
  }

  const src = album.coverArtUrl;

  return (
    <div className="group relative aspect-square">
      <a
        href={`/album/${album.id}`}
        className="block h-full w-full overflow-hidden rounded-sm"
      >
        {src ? (
          <Image
            src={src}
            alt={`${album.title} by ${album.artistName}`}
            fill
            sizes="(max-width: 640px) 23vw, 128px"
            className="object-cover"
            unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZED_IMAGES === "1"}
          />
        ) : (
          <Fallback title={album.title} artist={album.artistName} />
        )}
      </a>
      {isOwner && (
        <button
          onClick={handleRemove}
          disabled={pending}
          className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow group-hover:flex"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
}

function Fallback({ title, artist }: { title: string; artist: string }) {
  const hue = [...`${artist}${title}`].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="flex h-full w-full items-center justify-center text-sm font-semibold text-white/70"
      style={{ background: `linear-gradient(145deg, hsl(${hue} 32% 26%), hsl(${(hue + 40) % 360} 28% 14%))` }}
    >
      {title.slice(0, 2).toUpperCase()}
    </div>
  );
}

function SearchPanel({
  position,
  onSelect,
  onClose,
}: {
  position: number;
  onSelect: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        setResults(await res.json());
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const handlePick = (albumId: string) => {
    startTransition(async () => {
      await setFavouriteAlbum(position, albumId);
      onSelect();
    });
  };

  return (
    <div className="bg-ink-900 border-ink-700 rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-mist-300 text-sm font-medium">Pick an album for slot {position}</p>
        <button onClick={onClose} className="text-mist-500 hover:text-mist-200 text-sm transition-colors">
          Cancel
        </button>
      </div>
      <input
        ref={inputRef}
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search albums…"
        className="bg-ink-800 border-ink-700 text-mist-100 placeholder:text-mist-600 focus:border-accent-500 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
      />
      {loading && <p className="text-mist-500 text-xs">Searching…</p>}
      {results.length > 0 && (
        <ul className="divide-ink-800 divide-y">
          {results.map(r => (
            <li key={r.deezerId}>
              <button
                onClick={() => handlePick(r.deezerId)}
                disabled={saving}
                className="hover:bg-ink-800 flex w-full items-center gap-3 rounded px-2 py-2 text-left transition-colors disabled:opacity-50"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-ink-700">
                  {r.artworkUrl && (
                    <Image src={r.artworkUrl} alt={r.title} fill sizes="40px" className="object-cover"
                      unoptimized={process.env.NEXT_PUBLIC_UNOPTIMIZED_IMAGES === "1"} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-mist-100 truncate text-sm font-medium">{r.title}</p>
                  <p className="text-mist-400 truncate text-xs">{r.artistName}{r.year ? ` · ${r.year}` : ""}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && query.trim() && results.length === 0 && (
        <p className="text-mist-500 text-xs">No results found.</p>
      )}
    </div>
  );
}
