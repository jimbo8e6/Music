import Link from "next/link";

import { AlbumCard } from "@/components/AlbumCard";
import { EmptyState } from "@/components/EmptyState";
import { coverArtUrl } from "@/lib/coverart";
import { getEntries, type LibrarySort } from "@/lib/queries";

export const metadata = { title: "Library" };
export const dynamic = "force-dynamic";

const SORTS: { key: LibrarySort; label: string }[] = [
  { key: "recent", label: "Recently logged" },
  { key: "rating", label: "Highest rated" },
  { key: "artist", label: "Artist" },
  { key: "title", label: "Title" },
  { key: "year", label: "Release year" },
];

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "rated", label: "Rated" },
  { key: "reviews", label: "Reviewed" },
] as const;

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; filter?: string }>;
}) {
  const params = await searchParams;

  const sort = (SORTS.find((s) => s.key === params.sort)?.key ??
    "recent") as LibrarySort;
  const filter =
    FILTERS.find((f) => f.key === params.filter)?.key ?? "all";

  const rows = await getEntries({
    sort,
    ratedOnly: filter === "rated",
    reviewedOnly: filter === "reviews",
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">
          Your library
          <span className="text-mist-400 ml-2 text-sm font-normal tabular-nums">
            {rows.length}
          </span>
        </h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Tabs
            options={FILTERS.map((f) => ({ ...f }))}
            active={filter}
            paramKey="filter"
            otherParams={{ sort }}
          />
          <Tabs
            options={SORTS.map((s) => ({ key: s.key, label: s.label }))}
            active={sort}
            paramKey="sort"
            otherParams={{ filter }}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={
            filter === "all"
              ? "Albums you rate or review land here."
              : "No albums match that filter."
          }
          actionHref="/search"
          actionLabel="Find an album"
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {rows.map(({ entry, album }, index) => (
            <AlbumCard
              key={entry.id}
              href={`/album/${album.id}`}
              title={album.title}
              artist={album.artistName}
              year={album.year}
              coverUrl={coverArtUrl(album, 500)}
              rating={entry.rating}
              hasReview={Boolean(entry.reviewText)}
              priority={index < 6}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Tabs({
  options,
  active,
  paramKey,
  otherParams,
}: {
  options: { key: string; label: string }[];
  active: string;
  paramKey: string;
  otherParams: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {options.map((option) => {
        const query = new URLSearchParams({ ...otherParams, [paramKey]: option.key });
        const isActive = option.key === active;

        return (
          <Link
            key={option.key}
            href={`/library?${query}`}
            className={
              isActive
                ? "text-accent-400 text-xs font-semibold"
                : "text-mist-400 hover:text-mist-100 text-xs transition-colors"
            }
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
