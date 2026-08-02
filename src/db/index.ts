import path from "node:path";

import { createClient, type Client } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

import * as schema from "./schema";

/**
 * One driver for both environments.
 *
 * libSQL speaks to a local SQLite file (`file:` URL) and to a hosted Turso
 * database over the network with the same client, so local development and the
 * deployed app run identical code. Serverless hosts give you a read-only
 * filesystem, which a plain SQLite file cannot survive — hence the remote
 * database in production.
 */
function resolveConnection(): { url: string; authToken?: string; remote: boolean } {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();

  if (tursoUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!authToken) {
      throw new Error(
        "TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing. Both are needed to reach a hosted Turso database.",
      );
    }
    return { url: tursoUrl, authToken, remote: true };
  }

  // Local file. Accept a bare path for convenience and normalise it.
  const raw = process.env.DATABASE_URL?.trim() ?? "file:./wax.db";
  const url = raw.startsWith("file:") ? raw : `file:${raw}`;
  return { url, remote: false };
}

const connection = resolveConnection();

// Next reloads modules on every edit in dev; without this the process ends up
// holding dozens of open connections.
const globalForDb = globalThis as unknown as {
  __waxClient?: Client;
  __waxReady?: Promise<void>;
};

const client =
  globalForDb.__waxClient ??
  createClient({ url: connection.url, authToken: connection.authToken });

if (process.env.NODE_ENV !== "production") globalForDb.__waxClient = client;

export const db = drizzle(client, { schema });
export { schema };

/** True when talking to a hosted Turso database rather than a local file. */
export const isRemoteDatabase = connection.remote;

async function tableExists(name: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    sql`SELECT count(*) as count FROM sqlite_master WHERE type = 'table' AND name = ${name}`,
  );
  return Number(result?.count ?? 0) > 0;
}

/**
 * Adopts a database built by `drizzle-kit push` rather than by migrations.
 *
 * Push writes the tables straight from the schema and keeps no journal, so a
 * database created that way looks brand new to the migrator, which then tries
 * to CREATE TABLE over the top and fails.
 *
 * When the schema is there but the journal isn't, record the existing
 * migrations as already applied instead of replaying them. Migrations added
 * later still run: the migrator compares folder timestamps against the newest
 * recorded one, and these are stamped with their real timestamps.
 */
async function baselinePushedDatabase(migrationsFolder: string): Promise<void> {
  // Already migration-managed, or genuinely empty — the migrator handles both.
  if ((await tableExists("__drizzle_migrations")) || !(await tableExists("users"))) {
    return;
  }

  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) return;

  // Same DDL the migrator uses, so it adopts this table as its own.
  await db.run(
    sql`CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );

  for (const migration of migrations) {
    await db.run(
      sql`INSERT INTO __drizzle_migrations ("hash", "created_at") VALUES (${migration.hash}, ${migration.folderMillis})`,
    );
  }
}

/**
 * Brings the database up to date, once per process.
 *
 * Every read and write awaits this, so a fresh clone or a newly created Turso
 * database works with no setup step. The migrator records what it has applied,
 * making this a no-op after the first run.
 */
export function ready(): Promise<void> {
  globalForDb.__waxReady ??= (async () => {
    const migrationsFolder = path.join(process.cwd(), "drizzle");
    try {
      await baselinePushedDatabase(migrationsFolder);
      await migrate(db, { migrationsFolder });
    } catch (error) {
      // Serverless starts several instances at once, so two can race to apply
      // the first migration and the loser fails on "table already exists".
      // If the schema is there, someone won and there is nothing to report.
      if (await tableExists("users")) return;

      const where = connection.remote
        ? `the Turso database at ${connection.url}`
        : `the database file ${connection.url}`;
      throw new Error(
        `Could not prepare ${where}. Check the credentials and that ./drizzle is present. Original error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  })();

  return globalForDb.__waxReady;
}

/** The single local account. Swap this for a session lookup to go multi-user. */
export const LOCAL_USER_ID = "local";

/**
 * Resolves the acting user. Single-user for now, so it always returns the local
 * account, creating it on first run. When accounts land, this becomes a session
 * lookup and nothing downstream changes — every query already filters by userId.
 */
export async function getCurrentUser(): Promise<schema.User> {
  await ready();

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, LOCAL_USER_ID))
    .get();

  if (existing) return existing;

  // Concurrent requests can arrive here together on a cold database, so the
  // insert has to tolerate losing the race. Re-read rather than trusting a
  // RETURNING clause that yields nothing when the conflict is ignored.
  await db
    .insert(schema.users)
    .values({
      id: LOCAL_USER_ID,
      username: "you",
      displayName: "You",
      bio: null,
      avatarUrl: null,
    })
    .onConflictDoNothing();

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, LOCAL_USER_ID))
    .get();

  if (!user) {
    throw new Error(`Could not create the local account in ${connection.url}.`);
  }

  return user;
}
