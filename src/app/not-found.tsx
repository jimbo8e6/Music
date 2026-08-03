import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      body="That page doesn't exist, or the album couldn't be found."
      actionHref="/search"
      actionLabel="Search instead"
    />
  );
}
