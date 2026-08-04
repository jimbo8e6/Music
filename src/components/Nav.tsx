import { headers } from "next/headers";
import Link from "next/link";

import { logout } from "@/lib/actions";
import { SearchBox } from "@/components/SearchBox";

const LINKS = [
  { href: "/activity", label: "Activity" },
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Listen later" },
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href={username ? "/" : "/login"} className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-accent-500 text-ink-950 grid h-6 w-6 place-items-center rounded-full text-xs font-bold">
            W
          </span>
          Wax
        </Link>

        {username ? (
          <>
            <nav className="text-mist-300 order-3 flex items-center gap-5 text-sm sm:order-none">
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

            <div className="ml-auto w-full sm:w-72">
              <SearchBox />
            </div>

            <div className="text-mist-300 flex items-center gap-3 text-sm">
              <span className="text-mist-400">@{username}</span>
              <form action={logout}>
                <button
                  type="submit"
                  className="hover:text-mist-100 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-4 text-sm">
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
    </header>
  );
}
