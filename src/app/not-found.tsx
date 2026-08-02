import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      title="Not found"
      body="That album isn't in MusicBrainz under this id, or the page doesn't exist."
      actionHref="/search"
      actionLabel="Search instead"
    />
  );
}
