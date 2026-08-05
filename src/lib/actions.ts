"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db, getCurrentUser, ready, schema } from "@/db";
import {
  clearSessionCookie,
  createToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { sendNewUserNotification, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { getOrFetchAlbum } from "@/lib/queries";
import { MAX_RATING, PHYSICAL_FORMATS } from "@/lib/format";

const { entries, watchlist, collection, users, follows, favourites, emailTokens } = schema;

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface AuthFormState {
  error?: string;
  success?: boolean;
}

export interface EntryFormState {
  error?: string;
}

export async function registerUser(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !username || !password) return { error: "All fields are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3–20 characters: letters, numbers, underscores only." };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  await ready();

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  try {
    await db.insert(users).values({ id, username, displayName: username, email, passwordHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE") && msg.includes("email")) {
      return { error: "An account with that email already exists." };
    }
    if (msg.includes("UNIQUE") && msg.includes("username")) {
      return { error: "That username is taken." };
    }
    return { error: "Registration failed. Please try again." };
  }

  // Auto-follow wax_official so the owner can track new sign-ups via follower count
  const waxOfficial = await db.select().from(users).where(eq(users.username, "wax_official")).get();
  if (waxOfficial) {
    await db.insert(follows).values({ followerId: id, followingId: waxOfficial.id }).catch(() => {});
  }

  // Issue verification token and send email (non-blocking — failure doesn't abort registration)
  const verifyToken = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(emailTokens).values({ userId: id, token: verifyToken, type: "verify", expiresAt });
  sendVerificationEmail(email, verifyToken).catch(console.error);

  // Notify admin of new sign-up
  sendNewUserNotification(username, email).catch(console.error);

  const sessionToken = await createToken({ userId: id, username });
  await setSessionCookie(sessionToken);
  redirect("/register/check-email");
}

export async function loginUser(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) return { error: "Email/username and password are required." };

  await ready();

  const isEmail = identifier.includes("@");
  const user = isEmail
    ? await db.select().from(users).where(eq(users.email, identifier.toLowerCase())).get()
    : await db.select().from(users).where(eq(users.username, identifier)).get();

  if (!user?.passwordHash) return { error: "Invalid email/username or password." };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { error: "Invalid email/username or password." };

  const token = await createToken({ userId: user.id, username: user.username });
  await setSessionCookie(token);
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };

  await ready();
  const user = await db.select().from(users).where(eq(users.email, email)).get();

  // Always return success to avoid leaking which emails are registered
  if (user) {
    // Delete any existing reset tokens for this user
    await db.delete(emailTokens).where(
      and(eq(emailTokens.userId, user.id), eq(emailTokens.type, "reset")),
    );
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db.insert(emailTokens).values({ userId: user.id, token, type: "reset", expiresAt });
    sendPasswordResetEmail(email, token).catch(console.error);
  }

  return { success: true };
}

export async function resetPassword(
  token: string,
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Passwords don't match." };

  await ready();

  const row = await db.select().from(emailTokens).where(eq(emailTokens.token, token)).get();
  if (!row || row.type !== "reset" || row.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  const passwordHash = await hashPassword(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId));
  await db.delete(emailTokens).where(eq(emailTokens.id, row.id));

  redirect("/login?reset=1");
}

export async function followUser(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const followingId = String(formData.get("followingId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  if (!followingId || followingId === user.id) return;
  await db.insert(follows).values({ followerId: user.id, followingId }).onConflictDoNothing();
  revalidatePath(`/profile/${username}`);
}

export async function unfollowUser(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const followingId = String(formData.get("followingId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();
  if (!followingId) return;
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, user.id), eq(follows.followingId, followingId)));
  revalidatePath(`/profile/${username}`);
}

export async function setFavouriteAlbum(position: number, albumId: string): Promise<void> {
  if (position < 1 || position > 4) return;
  const user = await getCurrentUser();
  await getOrFetchAlbum(albumId);
  await db
    .insert(favourites)
    .values({ userId: user.id, albumId, position })
    .onConflictDoUpdate({
      target: [favourites.userId, favourites.position],
      set: { albumId },
    });
  revalidatePath(`/profile/${user.username}`);
}

export async function removeFavouriteAlbum(position: number): Promise<void> {
  if (position < 1 || position > 4) return;
  const user = await getCurrentUser();
  await db
    .delete(favourites)
    .where(and(eq(favourites.userId, user.id), eq(favourites.position, position)));
  revalidatePath(`/profile/${user.username}`);
}

export async function updateAvatar(dataUrl: string): Promise<void> {
  if (!dataUrl.startsWith("data:image/")) throw new Error("Invalid image data.");
  if (dataUrl.length > 300_000) throw new Error("Image too large.");
  const user = await getCurrentUser();
  await db.update(users).set({ avatarUrl: dataUrl }).where(eq(users.id, user.id));
  revalidatePath(`/profile/${user.username}`);
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

  const user = await getCurrentUser();
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

  await db
    .insert(entries)
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
    });

  // Logging an album means it is no longer something you're waiting to hear.
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.albumId, album.id)));

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/album/${album.id}`);
  redirect(`/album/${album.id}`);
}

export async function deleteEntry(formData: FormData): Promise<void> {
  const albumId = String(formData.get("albumId") ?? "");
  const user = await getCurrentUser();

  await db
    .delete(entries)
    .where(and(eq(entries.userId, user.id), eq(entries.albumId, albumId)));

  revalidatePath("/");
  revalidatePath("/library");
  revalidatePath(`/album/${albumId}`);
}

/** Saves which physical formats the user owns this album on. Empty selection removes it. */
export async function setOwnedFormats(formData: FormData): Promise<void> {
  const albumId = String(formData.get("albumId") ?? "").trim();
  if (!albumId) return;

  const album = await getOrFetchAlbum(albumId).catch(() => null);
  if (!album) return;

  const user = await getCurrentUser();
  const formats = PHYSICAL_FORMATS.filter((f) => formData.get(`format_${f}`) === "on");

  if (formats.length === 0) {
    await db
      .delete(collection)
      .where(and(eq(collection.userId, user.id), eq(collection.albumId, album.id)));
  } else {
    await db
      .insert(collection)
      .values({ userId: user.id, albumId: album.id, formats })
      .onConflictDoUpdate({
        target: [collection.userId, collection.albumId],
        set: { formats },
      });
  }

  revalidatePath(`/album/${album.id}`);
  revalidatePath("/library");
}

/** Adds to, or removes from, the listen-later list. */
export async function toggleWatchlist(formData: FormData): Promise<void> {
  const albumId = String(formData.get("albumId") ?? "").trim();
  if (!albumId) return;

  const album = await getOrFetchAlbum(albumId).catch(() => null);
  if (!album) return;

  const user = await getCurrentUser();
  const existing = await db
    .select({ id: watchlist.id })
    .from(watchlist)
    .where(and(eq(watchlist.userId, user.id), eq(watchlist.albumId, album.id)))
    .get();

  if (existing) {
    await db.delete(watchlist).where(eq(watchlist.id, existing.id));
  } else {
    await db.insert(watchlist).values({ userId: user.id, albumId: album.id });
  }

  revalidatePath("/watchlist");
  revalidatePath(`/album/${album.id}`);
}
