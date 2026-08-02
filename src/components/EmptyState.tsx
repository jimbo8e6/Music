import Link from "next/link";

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="surface flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-mist-400 max-w-md text-sm leading-relaxed">{body}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="btn btn-primary mt-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
