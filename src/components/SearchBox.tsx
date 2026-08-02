"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * `inline` is the compact one in the header; `prominent` is the search page's
 * own box, with a labelled button beside it.
 *
 * Both report progress. MusicBrainz can take a couple of seconds to answer, and
 * without a pending state pressing enter looks like it did nothing at all.
 */
export function SearchBox({
  defaultValue = "",
  autoFocus = false,
  placeholder = "Search albums…",
  variant = "inline",
  mode = "albums",
  filter,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  placeholder?: string;
  variant?: "inline" | "prominent";
  /** Which tab the search runs in; carried through so results stay in it. */
  mode?: "albums" | "artists";
  /** Album filter to keep in place when the query changes. */
  filter?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (!query) return;

    const params = new URLSearchParams({ q: query });
    if (mode === "artists") params.set("type", "artists");
    else if (filter && filter !== "studio") params.set("filter", filter);

    startTransition(() => {
      router.push(`/search?${params}`);
    });
  }

  if (variant === "prominent") {
    return (
      <form role="search" onSubmit={submit} className="flex w-full gap-2">
        <input
          type="search"
          name="q"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          aria-label="Search albums"
          className="field flex-1"
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={isPending || !value.trim()}
        >
          {isPending ? (
            <>
              <Spinner />
              Searching…
            </>
          ) : (
            "Search"
          )}
        </button>
      </form>
    );
  }

  return (
    <form role="search" onSubmit={submit} className="relative w-full">
      <input
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Search albums"
        className="field pr-10"
      />
      <button
        type="submit"
        aria-label="Search"
        disabled={isPending || !value.trim()}
        className="text-mist-400 hover:text-accent-400 absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 transition-colors disabled:opacity-50"
      >
        {isPending ? <Spinner /> : <span aria-hidden>⌕</span>}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="border-current/30 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-current align-[-2px]"
    />
  );
}
