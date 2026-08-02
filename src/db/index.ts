import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq } from "drizzle-orm";

import * as schema from "./schema";

const DB_PATH = process.env.DATABASE_URL ?? "./wax.db";

// Next dev reloads modules on every edit; without this the process ends up
// holding dozens of open handles to the same file.
const globalForDb = globalThis as unknown as {
  __waxSqlite?: Database.Database;
  __waxMigrated?: boolean;
};

const sqlite = globalForDb.__waxSqlite ?? new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
if (process.env.NODE_ENV !== "production") globalForDb.__waxSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
export { schema };

/**
 * Adopts a database built by `drizzle-kit push` rather than by migrations.
 *
 * Push writes the tables straight from the schema and keeps no journal, so a
 * database created that way looks brand new to the migrator, which then tries
 * to CREATE TABLE over the top and fails. Anyone who set the app up before
 * migrations were applied on boot has exactly that database.
 *
 * When the schema is there but the journal isn't, record the existing
 * migrations as already applied instead of replaying them. Migrations added
 * later still run: the migrator compares folder timestamps against the newest
 * recorded one, and these are stamped with their real timestamps.
 */
function baselinePushedDatabase(migrationsFolder: string): void {
  const tableExists = (name: string) =>
    Boolean(
      sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(name),
    );

  // Already migration-managed, or genuinely empty — the migrator handles both.
  if (tableExists("__drizzle_migrations") || !tableExists("users")) return;

  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) return;

  // Same DDL the migrator uses, so it adopts this table as its own.
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
  );

  const record = sqlite.prepare(
    'INSERT INTO `__drizzle_migrations` ("hash", "created_at") VALUES (?, ?)',
  );
  const stampAll = sqlite.transaction(() => {
    for (const migration of migrations) {
      record.run(migration.hash, migration.folderMillis);
    }
  });
  stampAll();
}

/**
 * Bring the database up to date on boot.
 *
 * SQLite here is a file next to the app, not a managed server, so there is no
 * deploy step to hang migrations off — starting the app *is* the deploy. Drizzle
 * records applied migrations in its own table, so this is a no-op once the
 * schema is current, and it means a fresh clone runs with nothing but
 * `npm install && npm run dev`.
 */
if (!globalForDb.__waxMigrated) {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  try {
    baselinePushedDatabase(migrationsFolder);
    migrate(db, { migrationsFolder });
    globalForDb.__waxMigrated = true;
  } catch (error) {
    throw new Error(
      `Could not prepare the database at ${DB_PATH}. The migration files in ./drizzle must be present and the path must be writable. Original error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

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
