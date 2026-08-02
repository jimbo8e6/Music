/**
 * Applies migrations from the command line.
 *
 * The app also migrates on startup, so this is mainly for pointing at a hosted
 * database before the first deploy:
 *
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:migrate
 */
import { isRemoteDatabase, ready } from "./index";

ready()
  .then(() => {
    console.log(
      `✓ schema up to date on the ${isRemoteDatabase ? "Turso" : "local"} database`,
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
