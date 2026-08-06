"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { addComment, deleteComment, toggleCommentLike } from "@/lib/actions";
import type { CommentNode, CommentRow } from "@/lib/queries";

const AUTO_COLLAPSE_DEPTH = 3;

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

function countDescendants(node: CommentNode): number {
  return node.children.reduce((n, c) => n + 1 + countDescendants(c), 0);
}

export function CommentsSection({
  entryId,
  comments,
  currentUserId,
}: {
  entryId: number;
  comments: CommentNode[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const afterMutation = () => {
    router.refresh();
    setShowForm(false);
  };

  const total = comments.reduce((n, c) => n + 1 + countDescendants(c), 0);

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
            <CommentThread
              key={c.id}
              node={c}
              entryId={entryId}
              currentUserId={currentUserId}
              onMutation={() => router.refresh()}
              depth={0}
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

function CommentThread({
  node,
  entryId,
  currentUserId,
  onMutation,
  depth,
}: {
  node: CommentNode;
  entryId: number;
  currentUserId: string | null;
  onMutation: () => void;
  depth: number;
}) {
  const startCollapsed = depth >= AUTO_COLLAPSE_DEPTH;
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const [replyingTo, setReplyingTo] = useState<{ parentId: number; username: string } | null>(null);

  const hasChildren = node.children.length > 0;
  const showInner = !collapsed && (hasChildren || replyingTo !== null);
  const descendantCount = countDescendants(node);

  const handleReply = (parentId: number, username: string) => {
    if (replyingTo?.parentId === parentId) {
      setReplyingTo(null);
    } else {
      setReplyingTo({ parentId, username });
      setCollapsed(false);
    }
  };

  const handleReplySubmit = async (body: string) => {
    if (!replyingTo) return;
    await addComment(entryId, body, replyingTo.parentId);
    onMutation();
    setReplyingTo(null);
  };

  return (
    <div id={`comment-${node.id}`} className="space-y-1.5">
      <CommentBubble
        comment={node}
        currentUserId={currentUserId}
        onDelete={onMutation}
        onReply={currentUserId ? () => handleReply(node.id, node.username) : undefined}
        isReplying={replyingTo?.parentId === node.id}
      />

      {collapsed && descendantCount > 0 && (
        <button
          onClick={() => setCollapsed(false)}
          className="text-mist-500 hover:text-accent-400 ml-9 text-xs transition-colors"
        >
          ▶ {descendantCount} {descendantCount === 1 ? "reply" : "replies"}
        </button>
      )}

      {showInner && (
        <div className="ml-3.5 flex gap-2">
          {/* Clickable collapse line */}
          <button
            onClick={() => setCollapsed(true)}
            className="group relative flex w-4 shrink-0 justify-center py-1"
            aria-label="Collapse thread"
            title="Collapse thread"
          >
            <span className="bg-ink-700 group-hover:bg-accent-500 absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors" />
          </button>

          <div className="min-w-0 flex-1 space-y-2">
            {node.children.map((child) => (
              <CommentThread
                key={child.id}
                node={child}
                entryId={entryId}
                currentUserId={currentUserId}
                onMutation={onMutation}
                depth={depth + 1}
              />
            ))}

            {replyingTo !== null && (
              <CommentForm
                onSubmit={handleReplySubmit}
                onCancel={() => setReplyingTo(null)}
                placeholder={`Reply to @${replyingTo.username}…`}
                compact
              />
            )}
          </div>
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
  isReplying = false,
}: {
  comment: CommentRow;
  currentUserId: string | null;
  onDelete: () => void;
  onReply?: () => void;
  isReplying?: boolean;
}) {
  const [deleting, startDelete] = useTransition();
  const [liked, setLiked] = useState(comment.viewerHasLiked);
  const [likeCount, setLikeCount] = useState(comment.likeCount);
  const [, startLike] = useTransition();

  const handleDelete = () => {
    startDelete(async () => {
      await deleteComment(comment.id);
      onDelete();
    });
  };

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    startLike(async () => {
      await toggleCommentLike(comment.id);
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
        <div className="mt-1 flex items-center gap-3">
          {currentUserId && currentUserId !== comment.userId && (
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition-colors ${liked ? "text-accent-400" : "text-mist-500 hover:text-mist-200"}`}
              title={liked ? "Unlike" : "Like"}
            >
              <SmallHeartIcon filled={liked} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
          )}
          {onReply && (
            <button
              onClick={onReply}
              className={`text-xs transition-colors ${isReplying ? "text-accent-400" : "text-mist-500 hover:text-mist-200"}`}
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

function SmallHeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="11"
      height="11"
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
