import { sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db, ready } from "@/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Takes a URL prefix (no leading wildcard) so the primary-key index is used.
  // e.g. prefix=deezer:https://api.deezer.com/artist/169
  const prefix = req.nextUrl.searchParams.get("prefix");
  if (!prefix) {
    return NextResponse.json({ error: "Missing prefix query param" }, { status: 400 });
  }

  const pattern = prefix + "%";

  await ready();

  const before = await db.get<{ count: number }>(
    sql`SELECT count(*) as count FROM mb_cache WHERE url LIKE ${pattern}`,
  );
  await db.run(sql`DELETE FROM mb_cache WHERE url LIKE ${pattern}`);

  return NextResponse.json({ deleted: before?.count ?? 0, prefix });
}
