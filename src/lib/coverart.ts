import type { Album } from "@/db/schema";

/**
 * Cover Art Archive sizes. The archive stores whatever the contributor
 * uploaded and generates these thumbnails; `1200` is the largest guaranteed
 * derivative, which is what the album page wants.
 */
export type CoverSize = 250 | 500 | 1200;

const CAA_BASE = "https://coverartarchive.org";

/**
 * Where to find the front cover for a release-group.
 *
 * CAA answers with a 307 to an Internet Archive node, so anything fetching this
 * must follow redirects (next/image does). A release-group with no uploaded art
 * returns 404 — callers render the fallback tile rather than an error.
 */
export function coverArtUrl(
  album: Pick<Album, "id" | "mbid" | "coverArtUrl">,
  size: CoverSize = 500,
): string | null {
  // Hand-added albums can carry an explicit URL; it wins over the derived one.
  if (album.coverArtUrl) return album.coverArtUrl;

  const mbid = album.mbid ?? (album.id.startsWith("local-") ? null : album.id);
  if (!mbid) return null;

  return `${CAA_BASE}/release-group/${mbid}/front-${size}`;
}

/**
 * The back of the sleeve, if anyone has uploaded one.
 *
 * Back covers hang off a specific release rather than the release group — the
 * group only ever exposes a front — so this needs the release we recorded when
 * the album was cached. Plenty of releases have no back image at all; callers
 * find out from the 404 and show something else.
 */
export function backCoverUrl(
  album: Pick<Album, "primaryReleaseId">,
  size: CoverSize = 500,
): string | null {
  if (!album.primaryReleaseId) return null;
  return `${CAA_BASE}/release/${album.primaryReleaseId}/back-${size}`;
}

/** Same, for a search result we haven't cached yet. */
export function coverArtUrlForMbid(mbid: string, size: CoverSize = 500): string {
  return `${CAA_BASE}/release-group/${mbid}/front-${size}`;
}
