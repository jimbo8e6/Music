"use client";

import { useTransition } from "react";
import Link from "next/link";

import { OwnedFormatsButton } from "@/components/OwnedFormatsButton";
import { toggleWatchlist } from "@/lib/actions";
import { useUserAlbumData } from "@/components/UserAlbumContext";

export function UserAlbumActions({ albumId }: { albumId: string }) {
  const { data, refresh } = useUserAlbumData();
  const [pending, startTransition] = useTransition();

  const handleWatchlist = () => {
    const fd = new FormData();
    fd.set("albumId", albumId);
    startTransition(async () => {
      await toggleWatchlist(fd);
      refresh();
    });
  };

  if (!data) {
    // Invisible placeholder to reserve button height
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        <div className="btn btn-primary w-full opacity-0 pointer-events-none">Rate or review</div>
      </div>
    );
  }

  const { loggedIn, entry, onWatchlist, ownedFormats } = data;

  return (
    <div className="flex flex-col gap-2">
      {loggedIn ? (
        <>
          <Link href={`/album/${albumId}/log`} className="btn btn-primary w-full">
            {entry ? "Edit your review" : "Rate or review"}
          </Link>

          {!entry && (
            <button
              type="button"
              onClick={handleWatchlist}
              disabled={pending}
              className="btn btn-ghost w-full disabled:opacity-50"
            >
              {onWatchlist ? "Remove from listen later" : "Listen later"}
            </button>
          )}

          <OwnedFormatsButton albumId={albumId} initialFormats={ownedFormats ?? []} />
        </>
      ) : (
        <Link href="/login" className="btn btn-primary w-full">
          Sign in to rate
        </Link>
      )}
    </div>
  );
}
