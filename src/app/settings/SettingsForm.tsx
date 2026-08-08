"use client";

import { useActionState } from "react";

import { savePreferences, type PreferencesFormState } from "@/lib/actions";
import type { CollectionSort, LibrarySort } from "@/lib/queries";

const LIBRARY_SORTS: { value: LibrarySort; label: string }[] = [
  { value: "recent", label: "Recently logged" },
  { value: "rating", label: "Highest rated" },
  { value: "artist", label: "Artist" },
  { value: "title", label: "Title" },
  { value: "year", label: "Release year" },
];

const COLLECTION_SORTS: { value: CollectionSort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "artist", label: "Artist" },
  { value: "title", label: "Title" },
  { value: "year", label: "Release year" },
];

export function SettingsForm({
  defaultLibrarySort,
  defaultCollectionSort,
}: {
  defaultLibrarySort: LibrarySort;
  defaultCollectionSort: CollectionSort;
}) {
  const [state, action, pending] = useActionState<PreferencesFormState, FormData>(
    savePreferences,
    {},
  );

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-mist-400 text-xs font-semibold tracking-wider uppercase">
          Library defaults
        </h2>

        <Field label="Default sort for Ratings tab">
          <Select name="defaultLibrarySort" defaultValue={defaultLibrarySort}>
            {LIBRARY_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Default sort for Collection tab">
          <Select name="defaultCollectionSort" defaultValue={defaultCollectionSort}>
            {COLLECTION_SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      {state.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}

      {state.success && (
        <p className="text-accent-400 text-sm">Settings saved.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent-500 hover:bg-accent-400 disabled:opacity-50 rounded-md px-4 py-2 text-sm font-medium text-ink-950 transition-colors"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-mist-300 text-sm">{label}</label>
      {children}
    </div>
  );
}

function Select({
  name,
  defaultValue,
  children,
}: {
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="bg-ink-800 border-ink-700 text-mist-200 rounded-md border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent-500"
    >
      {children}
    </select>
  );
}
