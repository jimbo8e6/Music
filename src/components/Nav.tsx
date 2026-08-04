import Link from "next/link";

import { SearchBox } from "@/components/SearchBox";

const LINKS = [
  { href: "/activity", label: "Activity" },
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Listen later" },
];

export function Nav() {
  return (
    <header className="border-ink-800 bg-ink-950/85 sticky top-0 z-20 border-b backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="bg-accent-500 text-ink-950 grid h-6 w-6 place-items-center rounded-full text-xs font-bold">
            W
          </span>
          Wax
        </Link>

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
      </div>
    </header>
  );
}
