"use client";

import { useState } from "react";

import { setOwnedFormats } from "@/lib/actions";
import { PHYSICAL_FORMATS } from "@/lib/format";

export function OwnedFormatsButton({
  albumId,
  initialFormats,
}: {
  albumId: string;
  initialFormats: string[];
}) {
  const [open, setOpen] = useState(false);

  const label =
    initialFormats.length > 0
      ? `Owned on ${initialFormats.join(" · ")}`
      : "Own this album?";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`btn btn-ghost w-full${initialFormats.length > 0 ? " text-accent-400" : ""}`}
      >
        {label}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="surface border-ink-800 absolute top-full left-0 right-0 z-20 mt-1 border p-4">
            <form
              action={setOwnedFormats}
              onSubmit={() => setOpen(false)}
            >
              <input type="hidden" name="albumId" value={albumId} />
              <p className="text-mist-400 mb-3 text-xs font-semibold tracking-wider uppercase">
                Formats owned
              </p>
              <div className="space-y-2.5">
                {PHYSICAL_FORMATS.map((format) => (
                  <label
                    key={format}
                    className="flex cursor-pointer items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      name={`format_${format}`}
                      defaultChecked={initialFormats.includes(format)}
                      className="accent-accent-500"
                    />
                    {format}
                  </label>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="submit" className="btn btn-primary flex-1 py-1.5 text-sm">
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="btn btn-ghost flex-1 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
