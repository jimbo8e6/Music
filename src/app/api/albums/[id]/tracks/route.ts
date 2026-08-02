import { NextResponse } from "next/server";

import { getTracklist } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * The tracklist, fetched only when someone actually turns a sleeve over.
 *
 * It costs a MusicBrainz request the first time, and the rate limiter has to
 * space that a second behind any other, so loading it with every album page
 * would slow down the common case to serve the uncommon one. Once fetched it is
 * cached on the album row and this returns instantly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { tracks, count } = await getTracklist(id);
    return NextResponse.json({ tracks, count });
  } catch {
    return NextResponse.json(
      { tracks: [], count: null, error: "Couldn't reach MusicBrainz." },
      { status: 502 },
    );
  }
}
