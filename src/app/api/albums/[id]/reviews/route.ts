import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { getAlbumCommunityReviews, getEntryComments } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headerStore = await headers();
  const currentUserId = headerStore.get("x-user-id") ?? null;

  const reviews = await getAlbumCommunityReviews(id, currentUserId);

  const reviewsWithComments = await Promise.all(
    reviews.map(async (review) => ({
      ...review,
      comments: await getEntryComments(review.id, currentUserId),
    })),
  );

  return NextResponse.json({ currentUserId, reviews: reviewsWithComments });
}
