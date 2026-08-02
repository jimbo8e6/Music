import { Suspense } from "react";
import Link from "next/link";

import { AlbumCard } from "@/components/AlbumCard";
import { fetchAppleNewReleases, type AppleRelease } from "@/lib/applemusic";
import { coverArtUrlForMbid } from "@/lib/coverart";
import { searchAlbums } from "@/lib/musicbrainz";
import { getHomeRecommendations } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <Suspense fallback={<RowSkeleton />}>
        <NewReleasesSection />
      </Suspense>

      <Suspense fallback={null}>
        <RecommendationsSection />
      </Suspense>
    </div>
  );
}

async function NewReleasesSection() {
  const appleReleases = await fetchAppleNewReleases({ limit: 8 });
  if (!appleReleases.length) return null;

  // Resolve a MusicBrainz ID for each Apple album so we can link into the app.
  // These searches go through the MB cache (12h TTL), so they're instant on
  // warm cache — the 1.1s rate limit only applies on a cold start.
  const releases = await Promise.all(appleReleases.map(resolveAppleRelease));

  return (
    <section className="space-y-4">
      <SectionHeading title="New Releases" />
      <ScrollRow>
        {releases.map(r => {
          const href = r.mbid
            ? `/album/${r.mbid}`
            : `/search?q=${encodeURIComponent(`${r.name} ${r.artistName}`)}`;
          return (
            <CardSlot key={r.id}>
              <AlbumCard
                href={href}
                title={r.name}
                artist={r.artistName}
                year={r.releaseDate ? new Date(r.releaseDate).getFullYear() : null}
                coverUrl={r.artworkUrl}
              />
            </CardSlot>
          );
        })}
      </ScrollRow>
    </section>
  );
}

/** Looks up the MusicBrainz release-group ID for an Apple Music album. */
async function resolveAppleRelease(r: AppleRelease): Promise<AppleRelease & { mbid: string | null }> {
  try {
    const results = await searchAlbums(`${r.name} ${r.artistName}`, { limit: 1, filter: "all" });
    return { ...r, mbid: results[0]?.mbid ?? null };
  } catch {
    return { ...r, mbid: null };
  }
}

async function RecommendationsSection() {
  const recs = await getHomeRecommendations({ limit: 12 });
  if (!recs.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeading
        title="You May Like"
        subtitle="Based on your ratings and recent browsing"
      />
      <ScrollRow>
        {recs.map(r => (
          <CardSlot key={r.mbid}>
            <AlbumCard
              href={`/album/${r.mbid}`}
              title={r.title}
              artist={r.artistName}
              year={r.year}
              coverUrl={coverArtUrlForMbid(r.mbid, 500)}
            />
          </CardSlot>
        ))}
      </ScrollRow>
    </section>
  );
}

function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto">
      <div className="flex gap-3 px-4 pb-3">
        {children}
      </div>
    </div>
  );
}

function CardSlot({ children }: { children: React.ReactNode }) {
  return <div className="w-36 shrink-0">{children}</div>;
}

function SectionHeading({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="border-ink-800 flex items-start justify-between border-b pb-2">
      <div>
        <h2 className="text-mist-400 text-xs font-semibold tracking-wider uppercase">
          {title}
        </h2>
        {subtitle && (
          <p className="text-mist-500 mt-0.5 text-xs">{subtitle}</p>
        )}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          className="text-mist-400 hover:text-accent-400 shrink-0 text-xs transition-colors"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

function RowSkeleton() {
  return (
    <section className="space-y-4" aria-hidden>
      <div className="border-ink-800 border-b pb-2">
        <div className="bg-ink-850 h-3 w-24 animate-pulse rounded" />
      </div>
      <div className="-mx-4 overflow-x-auto">
        <div className="flex gap-3 px-4 pb-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-36 shrink-0 animate-pulse">
              <div className="bg-ink-850 rounded-tile aspect-square" />
              <div className="mt-2 space-y-1.5">
                <div className="bg-ink-850 h-3 w-4/5 rounded" />
                <div className="bg-ink-850 h-2.5 w-3/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
