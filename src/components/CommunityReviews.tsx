import Link from "next/link";

import { CommentsSection } from "@/components/CommentsSection";
import { LikeButton } from "@/components/LikeButton";
import { Stars } from "@/components/Stars";
import { formatDate, formatRelative } from "@/lib/format";
import { getAlbumCommunityReviews, getEntryComments } from "@/lib/queries";
import type { CommunityReview } from "@/lib/queries";

async function ReviewCard({
  review,
  currentUserId,
}: {
  review: CommunityReview;
  currentUserId: string | null;
}) {
  const comments = await getEntryComments(review.id);

  return (
    <div className="surface space-y-4 p-5">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link href={`/profile/${review.username}`} className="shrink-0">
          <div className="bg-ink-700 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-mist-400">
            {review.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={review.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              review.displayName[0]?.toUpperCase()
            )}
          </div>
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href={`/profile/${review.username}`}
              className="text-mist-200 hover:text-accent-400 text-sm font-semibold transition-colors"
            >
              {review.displayName}
            </Link>
            {review.rating && <Stars rating={review.rating} size="sm" showValue />}
            {review.isFavorite && (
              <span className="text-star text-xs" title="Favourite">
                ♥
              </span>
            )}
            <span className="text-mist-500 ml-auto text-xs">
              {review.listenedOn
                ? `Listened ${formatDate(review.listenedOn)}`
                : `Logged ${formatRelative(review.createdAt)}`}
            </span>
          </div>

          {review.reviewTitle && (
            <h3 className="font-semibold">{review.reviewTitle}</h3>
          )}

          {review.reviewText && (
            <p className="text-mist-100 leading-relaxed whitespace-pre-wrap text-sm">
              {review.reviewText}
            </p>
          )}
        </div>
      </div>

      {review.reviewText && (
        <div className="flex items-center gap-4 border-t border-ink-800 pt-3">
          <LikeButton
            entryId={review.id}
            initialCount={review.likeCount}
            initialLiked={review.viewerHasLiked}
            disabled={!currentUserId}
          />
        </div>
      )}

      <CommentsSection
        entryId={review.id}
        comments={comments}
        currentUserId={currentUserId}
      />
    </div>
  );
}

export async function CommunityReviews({
  albumId,
  currentUserId,
}: {
  albumId: string;
  currentUserId: string | null;
}) {
  const reviews = await getAlbumCommunityReviews(albumId, currentUserId);
  if (reviews.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-mist-400 text-xs font-semibold uppercase tracking-wider">
        Reviews · {reviews.length}
      </h2>
      <div className="space-y-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} currentUserId={currentUserId} />
        ))}
      </div>
    </section>
  );
}
