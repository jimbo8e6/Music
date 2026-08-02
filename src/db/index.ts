import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";

import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? "./wax.db";

// Next dev reloads modules on every edit; without this the process ends up
// holding dozens of open handles to the same file.
const globalForDb = globalThis as unknown as {
  __waxSqlite?: Database.Database;
};

const sqlite = globalForDb.__waxSqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") globalForDb.__waxSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };

/** The single local account. Swap this for a session lookup to go multi-user. */
export const LOCAL_USER_ID = "local";

/**
 * Resolves the acting user. Single-user for now, so it always returns the local
 * account, creating it on first run. When accounts land, this becomes a session
 * lookup and nothing downstream changes — every query already filters by userId.
 */
export function getCurrentUser(): schema.User {
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, LOCAL_USER_ID))
    .get();

  if (existing) return existing;

  return db
    .insert(schema.users)
    .values({
      id: LOCAL_USER_ID,
      username: "you",
      displayName: "You",
      bio: null,
      avatarUrl: null,
    })
    .returning()
    .get();
}
