"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { StarInput } from "@/components/StarInput";
import { saveEntry, type EntryFormState } from "@/lib/actions";
import type { Entry } from "@/db/schema";

function SubmitButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving…" : isEdit ? "Update" : "Save"}
    </button>
  );
}

export function ReviewForm({
  albumId,
  entry,
}: {
  albumId: string;
  entry?: Entry;
}) {
  const [state, formAction] = useActionState<EntryFormState, FormData>(
    saveEntry,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="surface space-y-5 p-5">
      <input type="hidden" name="albumId" value={albumId} />

      <div className="space-y-2">
        <span className="text-mist-400 block text-xs font-semibold tracking-wider uppercase">
          Your rating
        </span>
        <StarInput defaultValue={entry?.rating ?? null} />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="reviewTitle"
          className="text-mist-400 block text-xs font-semibold tracking-wider uppercase"
        >
          Headline <span className="normal-case">(optional)</span>
        </label>
        <input
          id="reviewTitle"
          name="reviewTitle"
          type="text"
          maxLength={140}
          defaultValue={entry?.reviewTitle ?? ""}
          placeholder="A one-line verdict"
          className="field"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="reviewText"
          className="text-mist-400 block text-xs font-semibold tracking-wider uppercase"
        >
          Review
        </label>
        <textarea
          id="reviewText"
          name="reviewText"
          rows={8}
          defaultValue={entry?.reviewText ?? ""}
          placeholder="What did it sound like? What did it do to you?"
          className="field resize-y leading-relaxed"
        />
      </div>

      <div className="flex flex-wrap items-end gap-6">
        <div className="space-y-2">
          <label
            htmlFor="listenedOn"
            className="text-mist-400 block text-xs font-semibold tracking-wider uppercase"
          >
            Listened on
          </label>
          <input
            id="listenedOn"
            name="listenedOn"
            type="date"
            max={today}
            defaultValue={entry?.listenedOn ?? ""}
            className="field w-auto"
          />
        </div>

        <label className="text-mist-300 flex cursor-pointer items-center gap-2 pb-2.5 text-sm">
          <input
            type="checkbox"
            name="isFavorite"
            defaultChecked={entry?.isFavorite ?? false}
            className="accent-accent-500 h-4 w-4"
          />
          Favourite
        </label>
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          {state.error}
        </p>
      )}

      <div className="border-ink-800 flex items-center gap-3 border-t pt-4">
        <SubmitButton isEdit={Boolean(entry)} />
        <Link href={`/album/${albumId}`} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
