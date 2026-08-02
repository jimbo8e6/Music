import { notFound } from "next/navigation";

import type { Album } from "@/db/schema";
import { MusicBrainzError } from "@/lib/musicbrainz";
import { getOrFetchAlbum } from "@/lib/queries";

/**
 * Album loader for the album pages.
 *
 * A 404 (no such release-group) or 400 (the id isn't even a UUID) means the URL
 * is wrong, so render the not-found page. Anything else — MusicBrainz down,
 * rate-limited, network blocked — is a real failure and belongs in the error
 * boundary, not disguised as a missing album.
 */
export async function loadAlbumOrNotFound(id: string): Promise<Album> {
  let album: Album | null;

  try {
    album = await getOrFetchAlbum(id);
  } catch (error) {
    if (
      error instanceof MusicBrainzError &&
      (error.status === 404 || error.status === 400)
    ) {
      notFound();
    }
    throw error;
  }

  if (!album) notFound();
  return album;
}
