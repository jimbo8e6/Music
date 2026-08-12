import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getEntryComments, getEntryForAlbum, getOwnedFormats, isOnWatchlist } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headerStore = await headers();
  const currentUserId = headerStore.get("x-user-id") ?? null;

  if (!currentUserId) {
    return NextResponse.json({ loggedIn: false });
  }

  const [entry, onWatchlist, ownedFormats] = await Promise.all([
    getEntryForAlbum(id),
    isOnWatchlist(id),
    getOwnedFormats(id),
  ]);

  const entryComments = entry ? await getEntryComments(entry.id, currentUserId) : [];

  return NextResponse.json({
    loggedIn: true,
    currentUserId,
    entry: entry ?? null,
    onWatchlist,
    ownedFormats,
    entryComments,
  });
}
