import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";

import { AlbumCard } from "@/components/AlbumCard";
import { coverArtUrl } from "@/lib/coverart";
import { followUser, unfollowUser } from "@/lib/actions";
import {
  getUserByUsername,
  getProfileEntries,
  getProfileCollection,
  getProfileStats,
  isFollowing,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, { tab }] = await Promise.all([params, searchParams]);
  const activeTab = tab === "collection" ? "collection" : "ratings";

  const profileUser = await getUserByUsername(username);
  if (!profileUser) notFound();

  const headerStore = await headers();
  const currentUserId = headerStore.get("x-user-id") ?? "";
  const isOwnProfile = currentUserId === profileUser.id;

  const [entries, collectionItems, stats, following] = await Promise.all([
    activeTab === "ratings" ? getProfileEntries(profileUser.id, { limit: 24 }) : Promise.resolve([]),
    activeTab === "collection" ? getProfileCollection(profileUser.id) : Promise.resolve([]),
    getProfileStats(profileUser.id),
    isOwnProfile ? Promise.resolve(false) : isFollowing(currentUserId, profileUser.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{profileUser.displayName}</h1>
          <p className="text-mist-400 text-sm">@{profileUser.username}</p>
          {profileUser.bio && (
            <p className="text-mist-300 mt-2 max-w-prose text-sm">{profileUser.bio}</p>
          )}
          <div className="text-mist-400 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="text-mist-100 font-medium">{stats.logged}</span> logged
            </span>
            <span>
              <span className="text-mist-100 font-medium">{stats.rated}</span> rated
            </span>
            <Link href={`/profile/${profileUser.username}/followers`} className="hover:text-mist-200 transition-colors">
              <span className="text-mist-100 font-medium">{stats.followers}</span> followers
            </Link>
            <Link href={`/profile/${profileUser.username}/following`} className="hover:text-mist-200 transition-colors">
              <span className="text-mist-100 font-medium">{stats.following}</span> following
            </Link>
          </div>
        </div>

        {!isOwnProfile && (
          <form action={following ? unfollowUser : followUser}>
            <input type="hidden" name="followingId" value={profileUser.id} />
            <input type="hidden" name="username" value={profileUser.username} />
            <button
              type="submit"
              className={
                following
                  ? "border-ink-600 text-mist-300 hover:border-red-500/60 hover:text-red-400 rounded-md border px-4 py-1.5 text-sm transition-colors"
                  : "bg-accent-500 hover:bg-accent-400 text-ink-950 rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
              }
            >
              {following ? "Following" : "Follow"}
            </button>
          </form>
        )}

        {isOwnProfile && (
          <Link
            href="/library"
            className="text-mist-400 hover:text-mist-100 shrink-0 text-sm transition-colors"
          >
            Your library →
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="border-ink-800 flex gap-6 border-b">
        {[
          { key: "ratings", label: "Ratings" },
          { key: "collection", label: "Collection" },
        ].map(({ key, label }) => (
          <Link
            key={key}
            href={`/profile/${profileUser.username}${key === "ratings" ? "" : `?tab=${key}`}`}
            className={
              activeTab === key
                ? "text-mist-100 border-accent-500 -mb-px border-b-2 pb-2 text-sm font-medium"
                : "text-mist-400 hover:text-mist-200 pb-2 text-sm transition-colors"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {activeTab === "ratings" && (
        entries.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {entries.map(({ entry, album }, i) => (
              <AlbumCard
                key={entry.id}
                href={`/album/${album.id}`}
                title={album.title}
                artist={album.artistName}
                year={album.year}
                coverUrl={coverArtUrl(album, 500)}
                rating={entry.rating}
                hasReview={Boolean(entry.reviewText)}
                priority={i < 6}
              />
            ))}
          </div>
        ) : (
          <p className="text-mist-500 text-sm">No albums logged yet.</p>
        )
      )}

      {activeTab === "collection" && (
        collectionItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
            {collectionItems.map(({ album, formats }, i) => (
              <AlbumCard
                key={album.id}
                href={`/album/${album.id}`}
                title={album.title}
                artist={album.artistName}
                year={album.year}
                coverUrl={coverArtUrl(album, 500)}
                badge={formats.join(" · ")}
                priority={i < 6}
              />
            ))}
          </div>
        ) : (
          <p className="text-mist-500 text-sm">No physical albums in collection yet.</p>
        )
      )}
    </div>
  );
}
