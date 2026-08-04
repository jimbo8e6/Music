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

  // Check Last.fm reachability (used for popular albums on the home page).
  let lastfm: { ok: boolean; count?: number; error?: string } = { ok: false };
  try {
    const { checkLastFmHealth } = await import("@/lib/lastfm");
    lastfm = await checkLastFmHealth();
  } catch (err) {
    lastfm = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  // Check Deezer reachability (used for artist pages and album search — no credentials needed).
  let deezer: { ok: boolean; count?: number; error?: string } = { ok: false };
  try {
    const { checkDeezerHealth } = await import("@/lib/deezer");
    deezer = await checkDeezerHealth();
  } catch (err) {
    deezer = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(
    {
      ok: database.ok,
      connection,
      database,
      lastfm,
      deezer,
      lastfmConfigured: Boolean(process.env.LASTFM_API_KEY?.trim()),
      authSecret: Boolean(process.env.AUTH_SECRET?.trim()),
      musicbrainzContact: Boolean(process.env.MUSICBRAINZ_CONTACT?.trim()),
      node: process.version,
    },
    { status: database.ok ? 200 : 503 },
  );
}
