import { type NextRequest, NextResponse } from "next/server";

import { searchDeezerAlbums } from "@/lib/deezer";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);
  try {
    const results = await searchDeezerAlbums(q, { limit: 6 });
    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
