import type { Config } from "drizzle-kit";

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Turso is still SQLite; the separate dialect just carries the auth token.
  ...(tursoUrl
    ? {
        dialect: "turso" as const,
        dbCredentials: {
          url: tursoUrl,
          authToken: process.env.TURSO_AUTH_TOKEN,
        },
      }
    : {
        dialect: "sqlite" as const,
        dbCredentials: { url: process.env.DATABASE_URL ?? "file:./wax.db" },
      }),
} satisfies Config;
