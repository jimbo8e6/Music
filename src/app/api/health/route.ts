import { NextResponse } from "next/server";

import { describeConnection, ready } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Reports what the app thinks its database is and whether it can reach it.
 *
 * Next redacts server-side error messages in production builds, so a
 * misconfigured deployment shows an opaque 500 with no clue what is wrong.
 * This endpoint answers that question directly. It reports whether the
 * credentials are set, never their values, and always returns a body rather
 * than throwing.
 */
export async function GET() {
  const connection = describeConnection();

  let database: { ok: boolean; error?: string } = { ok: false };
  try {
    await ready();
    database = { ok: true };
  } catch (error) {
    database = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Check Apple RSS reachability.
  let appleRss: { ok: boolean; status?: number; count?: number; error?: string } = { ok: false };
  try {
    const url = "https://rss.applemarketingtools.com/api/v2/us/music/new-music/4/albums.json";
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = (await res.json()) as { feed?: { results?: unknown[] } };
      appleRss = { ok: true, status: res.status, count: data.feed?.results?.length ?? 0 };
    } else {
      appleRss = { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    appleRss = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(
    {
      ok: database.ok,
      connection,
      database,
      appleRss,
      authSecret: Boolean(process.env.AUTH_SECRET?.trim()),
      spotifyConfigured: Boolean(
        process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim(),
      ),
      musicbrainzContact: Boolean(process.env.MUSICBRAINZ_CONTACT?.trim()),
      node: process.version,
    },
    { status: database.ok ? 200 : 503 },
  );
}
