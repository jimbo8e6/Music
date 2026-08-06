"use client";

import { useState, useTransition } from "react";

import { toggleReviewLike } from "@/lib/actions";

export function LikeButton({
  entryId,
  initialCount,
  initialLiked,
  disabled,
}: {
  entryId: number;
  initialCount: number;
  initialLiked: boolean;
  disabled: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();

  const handleClick = () => {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      await toggleReviewLike(entryId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? "Sign in to like" : liked ? "Unlike" : "Like this review"}
      className={`flex items-center gap-1.5 text-xs transition-colors ${
        liked ? "text-accent-400" : "text-mist-500 hover:text-mist-200"
      } disabled:cursor-default`}
    >
      <HeartIcon filled={liked} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
