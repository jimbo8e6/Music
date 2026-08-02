import { eq } from "drizzle-orm";

/**
 * Durable cache for MusicBrainz responses, living in our own database.
 *
 * Next's fetch cache already covers a warm instance. This covers the rest: cold
 * starts, several instances running at once, and deployments that throw the
 * previous cache away — all of which otherwise mean paying the upstream cost
 * again for an answer we already had.
 *
 * Every failure here is swallowed. A cache that cannot be read is a miss, and a
 * cache that cannot be written is one fewer saving — neither is worth failing a
 * page over.
 */

/** Loaded lazily so this module can be imported without a database present. */
async function table() {
  const { db, schema } = await import("@/db");
  return { db, mbCache: schema.mbCache };
}

export async function readCache(
  url: string,
  maxAgeMs: number,
): Promise<unknown | null> {
  try {
    const { db, mbCache } = await table();
    const row = await db
      .select()
      .from(mbCache)
      .where(eq(mbCache.url, url))
      .get();

    if (!row) return null;
    if (Date.now() - row.fetchedAt.getTime() > maxAgeMs) return null;

    return JSON.parse(row.body) as unknown;
  } catch {
    return null;
  }
}

export async function writeCache(url: string, body: unknown): Promise<void> {
  try {
    const { db, mbCache } = await table();
    await db
      .insert(mbCache)
      .values({ url, body: JSON.stringify(body), fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: mbCache.url,
        set: { body: JSON.stringify(body), fetchedAt: new Date() },
      });
  } catch {
    // Nothing to do: the answer was still served.
  }
}
