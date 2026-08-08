import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { logout } from "@/lib/actions";
import { getNotifications } from "@/lib/queries";
import { BellPlaceholder, NotificationBell } from "@/components/NotificationBell";
import { HamburgerMenu } from "@/components/HamburgerMenu";
import { SearchBox } from "@/components/SearchBox";

const LINKS = [
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Listen later" },
  { href: "/people", label: "People" },
];

export async function Nav() {
  let username: string | null = null;
  let userId: string | null = null;
  try {
    const headerStore = await headers();
    username = headerStore.get("x-username");
    userId = headerStore.get("x-user-id");
  } catch {
    username = null;
    userId = null;
  }

  return (
    <header className="border-ink-800 bg-ink-950/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        {/* Main row */}
        <div className="flex items-center gap-x-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="bg-accent-500 text-ink-950 grid h-7 w-7 place-items-center rounded-full text-sm font-bold sm:h-6 sm:w-6 sm:text-xs">
              W
            </span>
            <span className="text-base sm:text-sm">Wax</span>
          </Link>

          {/* Desktop nav links */}
          {username && (
            <nav className="text-mist-300 hidden items-center gap-5 text-sm sm:flex">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-mist-100 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Desktop search */}
          <div className="ml-auto hidden w-72 sm:block">
            <SearchBox />
          </div>

          {username && userId ? (
            <div className="text-mist-300 ml-auto flex items-center gap-3 text-sm sm:ml-4">
              {/* Bell: always visible, left of username on desktop */}
              <Suspense fallback={<BellPlaceholder />}>
                <BellLoader userId={userId} />
              </Suspense>

              {/* Desktop: username + settings cog + sign out inline */}
              <Link
                href={`/profile/${username}`}
                className="text-mist-400 hover:text-mist-100 hidden transition-colors sm:inline"
              >
                @{username}
              </Link>
              <Link
                href="/settings"
                className="text-mist-400 hover:text-mist-100 hidden transition-colors sm:inline-flex"
                aria-label="Settings"
                title="Settings"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </Link>
              <form action={logout} className="hidden sm:block">
                <button type="submit" className="hover:text-mist-100 transition-colors">
                  Sign out
                </button>
              </form>

              {/* Hamburger: mobile only — holds nav links + @username + sign out */}
              <HamburgerMenu username={username} />
            </div>
          ) : (
            <div className="ml-auto flex items-center gap-4 text-sm sm:ml-4">
              <Link href="/login" className="text-mist-300 hover:text-mist-100 transition-colors">
                Sign in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-ink-950 transition-colors hover:bg-accent-400"
              >
                Register
              </Link>
            </div>
          )}
        </div>

        {/* Mobile second row: search only (nav links are in the hamburger) */}
        <div className="pb-3 sm:hidden">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}

async function BellLoader({ userId }: { userId: string }) {
  const items = await getNotifications(userId);
  return <NotificationBell initialItems={items} />;
}
