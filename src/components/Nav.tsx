import { headers } from "next/headers";
import Link from "next/link";

import { logout } from "@/lib/actions";
import { SearchBox } from "@/components/SearchBox";

const LINKS = [
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Listen later" },
  { href: "/people", label: "People" },
];

export async function Nav() {
  let username: string | null = null;
  try {
    const headerStore = await headers();
    username = headerStore.get("x-username");
  } catch {
    username = null;
  }

  return (
    <header className="border-ink-800 bg-ink-950/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto max-w-6xl px-4">
        {/* Main row — logo + desktop nav + desktop search + auth */}
        <div className="flex items-center gap-x-4 py-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">
            <span className="bg-accent-500 text-ink-950 grid h-7 w-7 place-items-center rounded-full text-sm font-bold sm:h-6 sm:w-6 sm:text-xs">
              W
            </span>
            <span className="text-base sm:text-sm">Wax</span>
          </Link>

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

          <div className="ml-auto hidden w-72 sm:block">
            <SearchBox />
          </div>

          {username ? (
            <div className="text-mist-300 ml-auto flex items-center gap-3 text-sm sm:ml-4">
              <Link
                href={`/profile/${username}`}
                className="text-mist-400 hover:text-mist-100 transition-colors"
              >
                @{username}
              </Link>
              <form action={logout}>
                <button type="submit" className="hover:text-mist-100 transition-colors">
                  Sign out
                </button>
              </form>
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

        {/* Mobile-only second row: search + nav links */}
        <div className="space-y-3 pb-3 sm:hidden">
          <SearchBox />
          {username && (
            <nav className="text-mist-300 flex items-center gap-5 text-sm">
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
        </div>
      </div>
    </header>
  );
}
