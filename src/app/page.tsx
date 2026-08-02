import Link from "next/link";

import { AlbumCard } from "@/components/AlbumCard";
import { EmptyState } from "@/components/EmptyState";
import { RatingHistogram } from "@/components/RatingHistogram";
import { Stars } from "@/components/Stars";
import { coverArtUrl } from "@/lib/coverart";
import { formatRelative, formatStars } from "@/lib/format";
import { getEntries, getStats } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const recent = getEntries({ limit: 12 });
  const reviews = getEntries({ limit: 4, reviewedOnly: true });
  const stats = getStats();

  if (recent.length === 0) {
    return (
      <EmptyState
        title="Nothing logged yet"
        body="Search for an album you've had on lately, give it a rating out of five and say what you thought. Everything you log shows up here."
        actionHref="/search"
        actionLabel="Find an album"
      />
    );
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Albums logged" value={String(stats.logged)} />
        <Stat label="Rated" value={String(stats.rated)} />
        <Stat label="Reviews written" value={String(stats.reviewed)} />
        <Stat
          label="Average rating"
          value={
            stats.averageRating === null
              ? "—"
              : formatStars(Math.round(stats.averageRating))
          }
        />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Recently logged" href="/library" linkLabel="All albums" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          {recent.map(({ entry, album }, index) => (
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
      </section>

      {reviews.length > 0 && (
        <section className="space-y-4">
          <SectionHeading title="Latest writing" href="/library?filter=reviews" linkLabel="All reviews" />
          <div className="space-y-3">
            {reviews.map(({ entry, album }) => (
              <Link
                key={entry.id}
                href={`/album/${album.id}`}
                className="surface hover:border-ink-700 block p-4 transition-colors"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-medium">{album.title}</h3>
                  <span className="text-mist-400 text-sm">
                    {album.artistName}
                    {album.year ? ` · ${album.year}` : ""}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <Stars rating={entry.rating} size="sm" />
                    <span className="text-mist-400 text-xs">
                      {formatRelative(entry.updatedAt)}
                    </span>
                  </span>
                </div>
                {entry.reviewTitle && (
                  <p className="text-mist-100 mt-2 text-sm font-medium">
                    {entry.reviewTitle}
                  </p>
                )}
                <p className="text-mist-300 mt-1 line-clamp-3 text-sm leading-relaxed">
                  {entry.reviewText}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {stats.rated > 0 && (
        <section className="space-y-4">
          <SectionHeading title="How you rate" />
          <RatingHistogram distribution={stats.distribution} />
        </section>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="border-ink-800 flex items-baseline justify-between border-b pb-2">
      <h2 className="text-mist-400 text-xs font-semibold tracking-wider uppercase">
        {title}
      </h2>
      {href && linkLabel && (
        <Link
          href={href}
          className="text-mist-400 hover:text-accent-400 text-xs transition-colors"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface px-4 py-3">
      <p className="text-mist-400 text-xs tracking-wide uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
