/**
 * Seeds the local account and, optionally, a few albums so the UI has something
 * in it on first run.
 *
 * Albums are resolved by searching MusicBrainz, so the MBIDs and artwork are
 * whatever upstream actually has — nothing here hard-codes an id that might be
 * wrong. With no network the script still creates the account and exits cleanly.
 *
 *   npm run db:seed              # account only
 *   npm run db:seed -- --albums  # account + example albums and ratings
 */
import { db, getCurrentUser, schema } from "./index";
import { searchAlbums } from "../lib/musicbrainz";

/** [search query, half-star rating, review] */
const EXAMPLES: [string, number, string | null][] = [
  ["Kid A Radiohead", 10, "Still sounds like it was beamed in from somewhere else."],
  ["In Rainbows Radiohead", 9, null],
  ["Illmatic Nas", 10, "Forty minutes, no filler, nothing left to prove."],
  ["Blue Joni Mitchell", 9, "The one you put on when you want to feel something specific."],
  ["Voodoo D'Angelo", 9, null],
  ["Untrue Burial", 8, "Rain on a night bus, rendered in garage."],
];

async function main() {
  const user = await getCurrentUser();
  console.log(`✓ local account ready (${user.username})`);

  if (!process.argv.includes("--albums")) {
    console.log("  pass --albums to also seed example albums");
    return;
  }

  for (const [query, rating, review] of EXAMPLES) {
    try {
      const [best] = await searchAlbums(query, { limit: 1 });
      if (!best) {
        console.warn(`  – no match for "${query}"`);
        continue;
      }

      await db
        .insert(schema.albums)
        .values({
          id: best.mbid,
          mbid: best.mbid,
          title: best.title,
          artistName: best.artistName,
          artistMbid: best.artistMbid,
          releaseDate: best.releaseDate,
          year: best.year,
          primaryType: best.primaryType,
          secondaryTypes: best.secondaryTypes,
        })
        .onConflictDoNothing();

      await db
        .insert(schema.entries)
        .values({
          userId: user.id,
          albumId: best.mbid,
          rating,
          reviewText: review,
        })
        .onConflictDoNothing();

      console.log(`  ✓ ${best.title} — ${best.artistName}`);
    } catch (error) {
      console.warn(
        `  – skipped "${query}": ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
