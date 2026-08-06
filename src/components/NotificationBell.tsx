"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";

import { markNotificationsRead } from "@/lib/actions";
import type { NotificationItem } from "@/lib/queries";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function NotificationBell({ initialItems }: { initialItems: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = items.filter((n) => !n.read).length;

  const handleOpen = () => {
    const opening = !open;
    setOpen(opening);
    if (opening && unreadCount > 0) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      startTransition(async () => {
        await markNotificationsRead();
      });
    }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="text-mist-400 hover:text-mist-100 relative transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="bg-accent-500 text-ink-950 absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-ink-900 border-ink-700 absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border shadow-xl">
          <div className="border-ink-800 border-b px-4 py-2.5">
            <h3 className="text-mist-300 text-xs font-semibold uppercase tracking-wider">
              Notifications
            </h3>
          </div>

          {items.length === 0 ? (
            <p className="text-mist-500 px-4 py-6 text-center text-sm">
              No notifications yet
            </p>
          ) : (
            <ul className="divide-ink-800 max-h-96 divide-y overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/album/${n.albumId}${n.commentId ? `#comment-${n.commentId}` : ""}`}
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-700 ${n.read ? "" : "bg-ink-800"}`}
                  >
                    <div className="bg-ink-700 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-mist-400">
                      {n.actorAvatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={n.actorAvatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        n.actorDisplayName[0]?.toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-mist-200 text-xs leading-snug">
                        <span className="font-semibold">@{n.actorUsername}</span>{" "}
                        {n.type === "reply"
                          ? "replied to your comment on"
                          : "commented on your review of"}{" "}
                        <span className="font-semibold">{n.albumTitle}</span>
                      </p>
                      {n.commentBody && (
                        <p className="text-mist-500 mt-0.5 truncate text-xs">{n.commentBody}</p>
                      )}
                      <p className="text-mist-600 mt-1 text-xs">{timeAgo(n.createdAt)}</p>
                    </div>

                    {!n.read && (
                      <div className="bg-accent-500 mt-2 h-2 w-2 shrink-0 rounded-full" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

export function BellPlaceholder() {
  return (
    <div className="text-mist-600">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
    </div>
  );
}
