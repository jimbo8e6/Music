"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { addComment, deleteComment } from "@/lib/actions";
import type { ThreadedComment, CommentRow } from "@/lib/queries";

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function CommentsSection({
  entryId,
  comments,
  currentUserId,
}: {
  entryId: number;
  comments: ThreadedComment[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const afterMutation = () => {
    router.refresh();
    setShowForm(false);
  };

  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  return (
    <div className="border-ink-800 space-y-4 border-t pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-mist-400 text-xs font-semibold uppercase tracking-wider">
          {total === 0 ? "Comments" : `Comments · ${total}`}
        </h3>
        {currentUserId && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-mist-400 hover:text-accent-400 text-xs transition-colors"
          >
            + Add comment
          </button>
        )}
      </div>

      {comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((c) => (
            <Thread
              key={c.id}
              comment={c}
              entryId={entryId}
              currentUserId={currentUserId}
              onMutation={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {showForm && currentUserId && (
        <CommentForm
          onSubmit={async (body) => {
            await addComment(entryId, body);
            afterMutation();
          }}
          onCancel={() => setShowForm(false)}
          placeholder="Write a comment…"
        />
      )}

      {!currentUserId && comments.length === 0 && (
        <p className="text-mist-500 text-xs">
          <Link href="/login" className="text-accent-400 hover:text-accent-300">Sign in</Link>{" "}
          to leave a comment.
        </p>
      )}
    </div>
  );
}

function Thread({
  comment,
  entryId,
  currentUserId,
  onMutation,
}: {
  comment: ThreadedComment;
  entryId: number;
  currentUserId: string | null;
  onMutation: () => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const handleReplySubmit = async (body: string) => {
    await addComment(entryId, body, comment.id);
    onMutation();
    setShowReplyForm(false);
    setShowReplies(true);
  };

  return (
    <div className="space-y-2">
      <CommentBubble
        comment={comment}
        currentUserId={currentUserId}
        onDelete={onMutation}
        onReply={currentUserId ? () => setShowReplyForm((v) => !v) : undefined}
      />

      {/* Reply form */}
      {showReplyForm && (
        <div className="ml-8">
          <CommentForm
            onSubmit={handleReplySubmit}
            onCancel={() => setShowReplyForm(false)}
            placeholder={`Reply to @${comment.username}…`}
            compact
          />
        </div>
      )}

      {/* Reply chain */}
      {comment.replies.length > 0 && (
        <div className="ml-8">
          <button
            onClick={() => setShowReplies((v) => !v)}
            className="text-mist-400 hover:text-mist-200 mb-2 text-xs transition-colors"
          >
            {showReplies
              ? "▲ Hide replies"
              : `▼ ${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`}
          </button>

          {showReplies && (
            <div className="border-ink-700 space-y-2 border-l pl-3">
              {comment.replies.map((r) => (
                <CommentBubble
                  key={r.id}
                  comment={r}
                  currentUserId={currentUserId}
                  onDelete={onMutation}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommentBubble({
  comment,
  currentUserId,
  onDelete,
  onReply,
}: {
  comment: CommentRow;
  currentUserId: string | null;
  onDelete: () => void;
  onReply?: () => void;
}) {
  const [deleting, startDelete] = useTransition();

  const handleDelete = () => {
    startDelete(async () => {
      await deleteComment(comment.id);
      onDelete();
    });
  };

  return (
    <div className="flex gap-2.5">
      {/* Avatar */}
      <Link href={`/profile/${comment.username}`} className="shrink-0">
        <div className="bg-ink-700 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-xs font-semibold text-mist-400">
          {comment.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={comment.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            comment.displayName[0]?.toUpperCase()
          )}
        </div>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <Link
            href={`/profile/${comment.username}`}
            className="text-mist-200 hover:text-accent-400 text-xs font-semibold transition-colors"
          >
            @{comment.username}
          </Link>
          <span className="text-mist-500 text-xs">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="text-mist-200 mt-0.5 text-sm leading-relaxed">{comment.body}</p>
        <div className="mt-1 flex gap-3">
          {onReply && (
            <button
              onClick={onReply}
              className="text-mist-500 hover:text-mist-200 text-xs transition-colors"
            >
              Reply
            </button>
          )}
          {currentUserId === comment.userId && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-mist-500 hover:text-red-400 text-xs transition-colors disabled:opacity-40"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentForm({
  onSubmit,
  onCancel,
  placeholder,
  compact = false,
}: {
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
  placeholder: string;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      await onSubmit(body);
      setBody("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={compact ? 2 : 3}
        maxLength={1000}
        autoFocus
        className="bg-ink-800 border-ink-700 text-mist-100 placeholder:text-mist-600 focus:border-accent-500 w-full resize-none rounded-md border px-3 py-2 text-sm outline-none transition-colors"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="bg-accent-500 hover:bg-accent-400 text-ink-950 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
        >
          {pending ? "Posting…" : "Post"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-mist-500 hover:text-mist-200 text-xs transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
