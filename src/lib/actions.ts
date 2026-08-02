"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, getCurrentUser, schema } from "@/db";
import { getOrFetchAlbum } from "@/lib/queries";
import { MAX_RATING } from "@/lib/format";

const { entries, watchlist } = schema;

export interface EntryFormState {
  error?: string;
}

function parseRating(raw: FormDataEntryValue | null): number | null {
  if (raw === null || raw === "" || raw === "0") return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_RATING) return null;
  return value;
}

/** Creates or updates this user's entry for an album, then returns to it. */
export async function saveEntry(
  _prev: EntryFormState,
  formData: FormData,
): Promise<EntryFormState> {
  const albumId = String(formData.get("albumId") ?? "").trim();
  if (!albumId) return { error: "Missing album." };

  const album = await getOrFetchAlbum(albumId).catch(() => null);
  if (!album) {
    return { error: "Could not load that album from MusicBrainz. Try again." };
  }

  const user = getCurrentUser();
  const rating = parseRating(formData.get("rating"));
  const reviewText = String(formData.get("reviewText") ?? "").trim() || null;
  const reviewTitle = String(formData.get("reviewTitle") ?? "").trim() || null;
  const listenedOnRaw = String(formData.get("listenedOn") ?? "").trim();
  const listenedOn = /^\d{4}-\d{2}-\d{2}$/.test(listenedOnRaw) ? listenedOnRaw : null;
  const isFavorite = formData.get("isFavorite") === "on";

  if (rating === null && !reviewText) {
    return { error: "Add a rating or write something before saving." };
  }

  const now = new Date();

  db.insert(entries)
    .values({
      userId: user.id,
      albumId: album.id,
      rating,
      reviewTitle,
      reviewText,
      listenedOn,
      isFavorite,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [entries.userId, entries.albumId],
      set: { rating, reviewTitle, reviewText, listenedOn, isFavorite, updatedAt: now },
    })
    .run();

  // Logging an album means it is no longer something you're waiting to hear.
  db.delete(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.albumId, album.id)))
    .run();

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/album/${album.id}`);
  redirect(`/album/${album.id}`);
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const albumId = String(formData.get("albumId") ?? "");
  const user = getCurrentUser();

  db.delete(entries)
    .where(and(eq(entries.userId, user.id), eq(entries.albumId, albumId)))
    .run();

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/album/${albumId}`);
}

/** Adds to, or removes from, the listen-later list. */
export async function toggleWatchlist(formData: FormData): Promise<void> {
  const albumId = String(formData.get("albumId") ?? "").trim();
  if (!albumId) return;

  const album = await getOrFetchAlbum(albumId).catch(() => null);
  if (!album) return;

  const user = getCurrentUser();
  const existing = db
    .select({ id: watchlist.id })
    .from(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.albumId, album.id)))
    .get();

  if (existing) {
    db.delete(watchlist).where(eq(watchlist.id, existing.id)).run();
  } else {
    db.insert(watchlist).values({ userId: user.id, albumId: album.id }).run();
  }

  revalidatePath("/watchlist");
  revalidatePath(`/album/${album.id}`);
}
