import Link from "next/link";
import { notFound } from "next/navigation";

import { getUserByUsername, getDetailedStats } from "@/lib/queries";
import { formatStars } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username} · Stats` };
}

export default async function StatsPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profileUser = await getUserByUsername(username);
  if (!profileUser) notFound();

  const stats = await getDetailedStats(profileUser.id);

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <Link
          href={`/profile/${username}`}
          className="text-mist-400 hover:text-mist-100 text-sm transition-colors"
        >
          ← @{username}
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Stats</h1>

      {stats.logged === 0 ? (
        <p className="text-mist-400 text-sm">No albums logged yet.</p>
      ) : (
        <>
          <SummaryTiles stats={stats} />
          {stats.rated > 0 && <RatingDistribution distribution={stats.distribution} total={stats.rated} />}
          {stats.decadeBreakdown.length > 0 && <DecadeBreakdown breakdown={stats.decadeBreakdown} total={stats.logged} />}
          {stats.genreBreakdown.length > 0 && <GenreBreakdown breakdown={stats.genreBreakdown} />}
          {stats.albumsWithDuration < stats.logged && stats.albumsWithDuration > 0 && (
            <p className="text-mist-500 text-xs">
              Listening time is based on {stats.albumsWithDuration} of {stats.logged} logged albums
              that have tracklist data loaded.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function formatListeningTime(ms: number): { primary: string; secondary?: string } {
  if (ms < 60_000) return { primary: "< 1 min" };
  const totalMinutes = Math.round(ms / 60_000);
  const totalHours = ms / 3_600_000;
  const days = Math.floor(totalHours / 24);
  const hours = Math.floor(totalHours % 24);
  const minutes = totalMinutes % 60;

  if (days >= 1) {
    return {
      primary: `${days}d ${hours}h`,
      secondary: `${Math.round(totalHours)} hours total`,
    };
  }
  if (totalHours >= 1) {
    return {
      primary: `${Math.floor(totalHours)}h ${minutes}m`,
    };
  }
  return { primary: `${totalMinutes} min` };
}

function SummaryTiles({ stats }: { stats: ReturnType<typeof getDetailedStats> extends Promise<infer T> ? T : never }) {
  const time = stats.totalMs > 0 ? formatListeningTime(stats.totalMs) : null;
  const avg = stats.averageRating !== null ? formatStars(Math.round(stats.averageRating)) : null;

  const tiles = [
    { label: "Albums logged", value: String(stats.logged) },
    {
      label: "Time listened",
      value: time?.primary ?? "—",
      sub: time?.secondary,
      dim: !time,
    },
    {
      label: "Average rating",
      value: avg ? `${avg} ★` : "—",
      sub: avg ? `from ${stats.rated} ratings` : "No ratings yet",
      dim: !avg,
    },
    { label: "Reviewed", value: String(stats.reviewed) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="surface space-y-1 rounded-lg p-4">
          <p className={`text-2xl font-bold tabular-nums ${tile.dim ? "text-mist-500" : "text-mist-100"}`}>
            {tile.value}
          </p>
          <p className="text-mist-400 text-xs">{tile.label}</p>
          {tile.sub && <p className="text-mist-500 text-xs">{tile.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function RatingDistribution({ distribution, total }: { distribution: number[]; total: number }) {
  const max = Math.max(...distribution, 1);
  const LABELS = ["0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"];

  return (
    <section className="space-y-4">
      <h2 className="text-mist-400 border-ink-800 border-b pb-2 text-xs font-semibold tracking-wider uppercase">
        Rating distribution
      </h2>
      <div className="space-y-1.5">
        {distribution.map((count, i) => {
          const pct = (count / max) * 100;
          const labelPct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-mist-400 w-7 shrink-0 text-right text-xs tabular-nums">
                {LABELS[i]}
              </span>
              <div className="flex-1">
                <div
                  className="bg-accent-500/70 h-4 rounded-sm transition-all"
                  style={{ width: count === 0 ? "2px" : `${pct}%`, opacity: count === 0 ? 0.15 : 1 }}
                />
              </div>
              <span className="text-mist-400 w-8 shrink-0 text-xs tabular-nums">
                {count > 0 ? (labelPct < 1 ? "<1%" : `${labelPct}%`) : ""}
              </span>
              <span className="text-mist-500 w-6 shrink-0 text-xs tabular-nums">
                {count > 0 ? count : ""}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DecadeBreakdown({
  breakdown,
  total,
}: {
  breakdown: { decade: number; count: number }[];
  total: number;
}) {
  const max = Math.max(...breakdown.map((d) => d.count), 1);

  function decadeLabel(decade: number): string {
    if (decade < 1900) return `Pre-${decade + 10}s`;
    return `${decade}s`;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-mist-400 border-ink-800 border-b pb-2 text-xs font-semibold tracking-wider uppercase">
        By decade
      </h2>
      <div className="space-y-1.5">
        {breakdown.map(({ decade, count }) => {
          const pct = (count / max) * 100;
          const share = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={decade} className="flex items-center gap-3">
              <span className="text-mist-400 w-14 shrink-0 text-right text-xs tabular-nums">
                {decadeLabel(decade)}
              </span>
              <div className="flex-1">
                <div
                  className="bg-accent-400/60 h-4 rounded-sm"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-mist-400 w-8 shrink-0 text-xs tabular-nums">
                {share < 1 ? "<1%" : `${share}%`}
              </span>
              <span className="text-mist-500 w-6 shrink-0 text-xs tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GenreBreakdown({
  breakdown,
}: {
  breakdown: { genre: string; count: number }[];
}) {
  const max = breakdown[0]?.count ?? 1;

  return (
    <section className="space-y-4">
      <h2 className="text-mist-400 border-ink-800 border-b pb-2 text-xs font-semibold tracking-wider uppercase">
        Top genres
      </h2>
      <div className="space-y-1.5">
        {breakdown.map(({ genre, count }) => {
          const pct = (count / max) * 100;
          return (
            <div key={genre} className="flex items-center gap-3">
              <span className="text-mist-300 w-32 shrink-0 truncate text-right text-xs sm:w-40">
                {genre}
              </span>
              <div className="flex-1">
                <div
                  className="bg-accent-600/50 h-4 rounded-sm"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-mist-500 w-6 shrink-0 text-xs tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
