"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-mist-400 max-w-md text-sm leading-relaxed">
        This usually means MusicBrainz couldn&apos;t be reached — it rate-limits
        to one request a second and occasionally goes down for maintenance.
      </p>
      {error.message && (
        <p className="text-mist-500 max-w-md font-mono text-xs">{error.message}</p>
      )}
      <button type="button" onClick={reset} className="btn btn-primary mt-2">
        Try again
      </button>
    </div>
  );
}
