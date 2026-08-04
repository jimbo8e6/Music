import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { Stars } from "@/components/Stars";
import { getEntries } from "@/lib/queries";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

function dayKey(date: Date): string {
  return date.toLocaleDateString("en-CA"); // YYYY-MM-DD, locale-stable
}

function dayLabel(date: Date): string {
  const now = new Date();
  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getTime() - 86_400_000));
  const key = dayKey(date);

  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";

  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export default async function ActivityPage() {
  const items = await getEntries({ sort: "recent", ratedOnly: true });

  if (items.length === 0) {
    return (
      <EmptyState
        title="No ratings yet"
        body="Rate an album and it'll appear here."
        actionHref="/search"
        actionLabel="Find an album"
      />
    );
  }

  const groups: { key: string; label: string; items: typeof items }[] = [];

  for (const item of items) {
    const key = dayKey(item.entry.updatedAt);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: dayLabel(item.entry.updatedAt), items: [item] });
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {groups.map((group) => (
        <section key={group.key}>
          <h2 className="text-mist-400 border-ink-800 mb-1 border-b pb-2 text-xs font-semibold tracking-wider uppercase">
            {group.label}
          </h2>
          <ul className="divide-ink-800 divide-y">
            {group.items.map(({ entry, album }) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/album/${album.id}`}
                    className="text-mist-100 hover:text-accent-400 block truncate font-medium transition-colors"
                  >
                    {album.title}
                  </Link>
                  <p className="text-mist-400 truncate text-sm">{album.artistName}</p>
                </div>
                <div className="shrink-0">
                  <Stars rating={entry.rating} size="sm" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
