import { notFound } from "next/navigation";
import Link from "next/link";

import { getUserByUsername, getFollowers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return { title: `Followers · @${username}` };
}

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profileUser = await getUserByUsername(username);
  if (!profileUser) notFound();

  const users = await getFollowers(profileUser.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/profile/${username}`} className="text-mist-400 hover:text-mist-100 text-sm transition-colors">
          ← @{username}
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Followers</h1>
      </div>

      {users.length === 0 ? (
        <p className="text-mist-500 text-sm">No followers yet.</p>
      ) : (
        <ul className="divide-ink-800 divide-y">
          {users.map((user) => (
            <li key={user.id}>
              <Link
                href={`/profile/${user.username}`}
                className="hover:bg-ink-900 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors"
              >
                <div className="bg-accent-500/15 text-accent-400 grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-semibold">
                  {user.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-mist-100 text-sm font-medium">{user.displayName}</p>
                  <p className="text-mist-500 text-xs">@{user.username}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
