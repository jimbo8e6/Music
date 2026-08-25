import { like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db, schema } from "@/db";

// Protect with a secret so this can't be called by anyone.
// Set ADMIN_SECRET in your environment variables.
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pattern = req.nextUrl.searchParams.get("pattern");
  if (!pattern) {
    return NextResponse.json({ error: "Missing pattern query param" }, { status: 400 });
  }

  const result = await db
    .delete(schema.mbCache)
    .where(like(schema.mbCache.url, pattern))
    .returning({ url: schema.mbCache.url });

  return NextResponse.json({ deleted: result.length, urls: result.map((r) => r.url) });
}
