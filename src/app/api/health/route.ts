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

  return NextResponse.json(
    {
      ok: database.ok,
      connection,
      database,
      musicbrainzContact: Boolean(process.env.MUSICBRAINZ_CONTACT?.trim()),
      node: process.version,
    },
    { status: database.ok ? 200 : 503 },
  );
}
