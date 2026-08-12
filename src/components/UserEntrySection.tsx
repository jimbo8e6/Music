"use client";

import { useTransition } from "react";
import Link from "next/link";

import { CommentsSection } from "@/components/CommentsSection";
import { Stars } from "@/components/Stars";
import { deleteEntry } from "@/lib/actions";
import { formatDate, formatRelative } from "@/lib/format";
import { useUserAlbumData } from "@/components/UserAlbumContext";

export function UserEntrySection({ albumId }: { albumId: string }) {
  const { data, refresh } = useUserAlbumData();
  const [pending, startTransition] = useTransition();

  if (!data) return null;

  const { loggedIn, entry, entryComments, currentUserId } = data;

  const handleDelete = () => {
    const fd = new FormData();
    fd.set("albumId", albumId);
    startTransition(async () => {
      await deleteEntry(fd);
      refresh();
    });
  };

  if (entry) {
    return (
      <section className="surface space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Stars rating={entry.rating} size="lg" showValue />
          {entry.isFavorite && (
            <span className="text-star text-sm" title="Favourite">
              ♥ Favourite
            </span>
          )}
          <span className="text-mist-400 ml-auto text-xs">
            {entry.listenedOn
              ? `Listened ${formatDate(entry.listenedOn)}`
              : `Logged ${formatRelative(new Date(entry.createdAt))}`}
          </span>
        </div>

        {entry.reviewTitle && (
          <h2 className="text-lg font-semibold">{entry.reviewTitle}</h2>
        )}

        {entry.reviewText && (
          <div className="text-mist-100 space-y-3 leading-relaxed whitespace-pre-wrap">
            {entry.reviewText}
          </div>
        )}

        <div className="border-ink-800 flex items-center gap-4 border-t pt-3">
          <Link
            href={`/album/${albumId}/log`}
            className="text-mist-400 hover:text-accent-400 text-xs transition-colors"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-mist-400 text-xs transition-colors hover:text-red-400 disabled:opacity-40"
          >
            Remove from library
          </button>
        </div>

        <CommentsSection
          entryId={entry.id}
          comments={entryComments ?? []}
          currentUserId={currentUserId ?? null}
          onMutation={refresh}
        />
      </section>
    );
  }

  if (loggedIn) {
    return (
      <section className="border-ink-800 text-mist-400 rounded-lg border border-dashed px-5 py-8 text-sm">
        You haven&apos;t logged this one yet.
      </section>
    );
  }

  return null;
}
