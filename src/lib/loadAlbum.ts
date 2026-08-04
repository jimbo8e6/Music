import { notFound } from "next/navigation";

import type { Album } from "@/db/schema";
import { DeezerError } from "@/lib/deezer";
import { MusicBrainzError } from "@/lib/musicbrainz";
import { getOrFetchAlbum } from "@/lib/queries";
import { SpotifyError } from "@/lib/spotify";

export async function loadAlbumOrNotFound(id: string): Promise<Album> {
  let album: Album | null;

  try {
    album = await getOrFetchAlbum(id);
  } catch (error) {
    if (
      (error instanceof MusicBrainzError ||
        error instanceof SpotifyError ||
        error instanceof DeezerError) &&
      (error.status === 404 || error.status === 400)
    ) {
      notFound();
    }
    throw error;
  }

  if (!album) notFound();
  return album;
}
