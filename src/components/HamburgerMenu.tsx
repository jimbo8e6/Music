"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { logout } from "@/lib/actions";

const NAV_LINKS = [
  { href: "/library", label: "Library" },
  { href: "/watchlist", label: "Listen later" },
  { href: "/people", label: "People" },
];

export function HamburgerMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative sm:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-mist-400 hover:text-mist-100 transition-colors"
        aria-label="Menu"
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open && (
        <div className="bg-ink-900 border-ink-700 absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border shadow-xl">
          <nav className="py-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-mist-300 hover:text-mist-100 hover:bg-ink-800 block px-4 py-2.5 text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="border-ink-700 border-t py-1">
            <Link
              href={`/profile/${username}`}
              onClick={() => setOpen(false)}
              className="text-mist-300 hover:text-mist-100 hover:bg-ink-800 block px-4 py-2.5 text-sm transition-colors"
            >
              @{username}
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-mist-300 hover:text-mist-100 hover:bg-ink-800 block w-full px-4 py-2.5 text-left text-sm transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
