"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({
  defaultValue = "",
  autoFocus = false,
  placeholder = "Search albums…",
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const query = value.trim();
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`);
      }}
      className="relative w-full"
    >
      <input
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Search albums"
        className="field pl-9"
      />
      <span
        aria-hidden
        className="text-mist-400 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
      >
        ⌕
      </span>
    </form>
  );
}
