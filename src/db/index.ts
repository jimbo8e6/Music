import path from "node:path";

import { cookies, headers } from "next/headers";
import type { Client } from "@libsql/core/api";
// The `/web` entry is pure JavaScript. The default entry statically pulls in
// the native `libsql` bindings for `file:` support, and serverless bundlers
// routinely fail to ship those `.node` binaries — which takes down every route,
// since this module is imported by all of them.
import { createClient as createRemoteClient } from "@libsql/client/web";
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
interface Connection {
  url: string;
  authToken?: string;
  remote: boolean;
  /** Set when the configuration cannot work, for a clear error at first use. */
  problem?: string;
}

/** True on hosts whose filesystem is read-only and discarded between requests. */
const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

function resolveConnection(): Connection {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();

  if (tursoUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    return {
      url: tursoUrl,
      authToken,
      remote: true,
      problem: authToken
        ? undefined
        : "TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing. Both are needed to reach a hosted Turso database.",
    };
  }

  // Local file. Accept a bare path for convenience and normalise it.
  const raw = process.env.DATABASE_URL?.trim() ?? "file:./wax.db";
  const url = raw.startsWith("file:") ? raw : `file:${raw}`;

  return {
    url,
    remote: false,
    problem: IS_SERVERLESS
      ? "No hosted database is configured. This host has a read-only, per-request filesystem, so a local SQLite file cannot be used. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the deployment's environment variables and redeploy."
      : undefined,
  };
}

const connection = resolveConnection();

/**
 * Opens the connection. Remote uses the pure-JS client imported above; a local
 * file needs the native bindings, required lazily so they are never loaded —
 * or needed — on a serverless host.
 */
function openClient(): Client {
  if (connection.remote) {
    return createRemoteClient({
      url: connection.url,
      authToken: connection.authToken,
    });
  }

  // Reached through process rather than an import: webpack rewrites a
  // `node:module` import to a stub in this build, and an ordinary import of
  // @libsql/client would load the native bindings on every host, including the
  // ones that cannot use them.
  const getBuiltinModule = (
    process as NodeJS.Process & {
      getBuiltinModule?: (id: string) => { createRequire: (from: string) => NodeRequire };
    }
  ).getBuiltinModule;

  if (!getBuiltinModule) {
    throw new Error(
      "Opening a local database file needs Node 20.16+ or 22.3+. Upgrade Node, or set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use a hosted database instead.",
    );
  }

  const requireFromApp = getBuiltinModule("module").createRequire(
    path.join(process.cwd(), "package.json"),
  );
  const { createClient } = requireFromApp("@libsql/client") as {
    createClient: (config: { url: string }) => Client;
  };
  return createClient({ url: connection.url });
}

// Next reloads modules on every edit in dev; without this the process ends up
// holding dozens of open connections.
const globalForDb = globalThis as unknown as {
  __waxClient?: Client;
  __waxReady?: Promise<void>;
};

const client = globalForDb.__waxClient ?? openClient();

if (process.env.NODE_ENV !== "production") globalForDb.__waxClient = client;

export const db = drizzle(client, { schema });
export { schema };

/** True when talking to a hosted Turso database rather than a local file. */
export const isRemoteDatabase = connection.remote;

/**
 * Configuration summary for the health endpoint. Reports whether the secrets
 * are present, never what they are.
 */
export function describeConnection() {
  let host: string | null = null;
  try {
    host = connection.remote ? new URL(connection.url).host : null;
  } catch {
    host = "unparseable";
  }

  return {
    mode: connection.remote ? ("turso" as const) : ("local-file" as const),
    serverless: IS_SERVERLESS,
    host,
    localPath: connection.remote ? null : connection.url,
    hasTursoUrl: Boolean(process.env.TURSO_DATABASE_URL?.trim()),
    hasTursoToken: Boolean(process.env.TURSO_AUTH_TOKEN?.trim()),
    problem: connection.problem ?? null,
  };
}

async function tableExists(name: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    sql`SELECT count(*) as count FROM sqlite_master WHERE type = 'table' AND name = ${name}`,
  );
  return Number(result?.count ?? 0) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const result = await db.get<{ count: number }>(
    sql`SELECT count(*) as count FROM pragma_table_info(${table}) WHERE name = ${column}`,
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
    if (connection.problem) throw new Error(connection.problem);

    const migrationsFolder = path.join(process.cwd(), "drizzle");
    try {
      await baselinePushedDatabase(migrationsFolder);
      await migrate(db, { migrationsFolder });

      // Safety: if the DB was baselined from a db:push that predated this
      // column, the migration was marked as applied without running the DDL.
      if (!(await columnExists("albums", "artist_spotify_id"))) {
        await db.run(sql`ALTER TABLE albums ADD artist_spotify_id text`);
      }
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

/** Fallback used only when no session cookie exists (e.g. server actions called outside a request). */
export const LOCAL_USER_ID = "local";

/**
 * Resolves the acting user from the browser's session cookie.
 * Each browser gets its own UUID (set by middleware), so data is
 * isolated per device with no login required.
 */
export async function getCurrentUser(): Promise<schema.User> {
  await ready();

  // Cookie is the normal path; the x-wax-session header covers the very
  // first render before the Set-Cookie response lands on the client.
  let userId: string;
  try {
    const cookieStore = await cookies();
    const headerStore = await headers();
    userId =
      cookieStore.get("wax_session")?.value ??
      headerStore.get("x-wax-session") ??
      LOCAL_USER_ID;
  } catch {
    // Outside a request context (e.g. build-time or test) — use fallback.
    userId = LOCAL_USER_ID;
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (existing) return existing;

  // Concurrent requests can arrive here together on a cold database, so the
  // insert has to tolerate losing the race. Re-read rather than trusting a
  // RETURNING clause that yields nothing when the conflict is ignored.
  await db
    .insert(schema.users)
    .values({
      id: userId,
      username: "you",
      displayName: "You",
      bio: null,
      avatarUrl: null,
    })
    .onConflictDoNothing();

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!user) {
    throw new Error(`Could not create the local account in ${connection.url}.`);
  }

  return user;
}
