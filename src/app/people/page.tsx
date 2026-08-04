import Link from "next/link";

import { searchUsers } from "@/lib/queries";

export const metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const users = q.trim() ? await searchUsers(q) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Find people</h1>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by username…"
          autoFocus={!q}
          className="bg-ink-900 border-ink-700 text-mist-100 placeholder:text-mist-600 focus:border-accent-500 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors"
        />
        <button
          type="submit"
          className="bg-accent-500 hover:bg-accent-400 text-ink-950 shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Search
        </button>
      </form>

      {q && users.length === 0 && (
        <p className="text-mist-500 text-sm">No users found for &ldquo;{q}&rdquo;.</p>
      )}

      {users.length > 0 && (
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
