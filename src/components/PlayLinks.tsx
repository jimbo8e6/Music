import type { ExternalLinks } from "@/lib/musicbrainz";

/**
 * Where to go and hear it.
 *
 * MusicBrainz records streaming links for a good share of release groups but
 * nothing like all of them, so a missing link falls back to a search on the
 * service — which still lands you one click away, and never leaves a dead
 * button on the page. Both shapes render identically, so resolving the exact
 * link doesn't shift the layout.
 */
export function PlayLinks({
  links,
  title,
  artist,
}: {
  links: ExternalLinks;
  title: string;
  artist: string;
}) {
  const term = encodeURIComponent(`${artist} ${title}`);

  const services = [
    {
      name: "Spotify",
      href: links.spotify ?? `https://open.spotify.com/search/${term}`,
      exact: Boolean(links.spotify),
      icon: <SpotifyMark />,
      hover: "hover:border-[#1db954]/60 hover:text-[#1db954]",
      searchable: true,
    },
    {
      name: "Apple Music",
      href: links.appleMusic ?? `https://music.apple.com/search?term=${term}`,
      exact: Boolean(links.appleMusic),
      icon: <AppleMark />,
      hover: "hover:border-[#fa2d48]/60 hover:text-[#fa2d48]",
      searchable: true,
    },
    {
      name: "Bandcamp",
      href: links.bandcamp ?? "",
      exact: Boolean(links.bandcamp),
      icon: <BandcampMark />,
      hover: "hover:border-[#1da0c3]/60 hover:text-[#1da0c3]",
      // Most records simply aren't on Bandcamp, and a search that finds
      // nothing is worse than no button at all.
      searchable: false,
    },
    {
      name: "YouTube",
      href: links.youtube ?? "",
      exact: Boolean(links.youtube),
      icon: <YouTubeMark />,
      hover: "hover:border-[#ff0033]/60 hover:text-[#ff0033]",
      searchable: false,
    },
    {
      name: "Deezer",
      href: links.deezer ?? `https://www.deezer.com/search/${term}`,
      exact: Boolean(links.deezer),
      icon: <DeezerMark />,
      hover: "hover:border-[#ef5466]/60 hover:text-[#ef5466]",
      searchable: true,
    },
  ].filter((service) => service.exact || service.searchable);

  return (
    <div className="flex flex-col gap-2">
      {services.map((service) => (
        <a
          key={service.name}
          href={service.href}
          target="_blank"
          rel="noreferrer"
          title={
            service.exact
              ? `Open ${title} on ${service.name}`
              : `Search ${service.name} for ${title}`
          }
          className={`btn btn-ghost w-full justify-start gap-3 ${service.hover}`}
        >
          {service.icon}
          <span className="flex-1 text-left">
            {service.exact ? `Play on ${service.name}` : `Find on ${service.name}`}
          </span>
          <span aria-hidden className="text-xs opacity-60">
            ↗
          </span>
        </a>
      ))}
    </div>
  );
}

function DeezerMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-current">
      <path d="M18.95 14.4h4.05v1.6h-4.05zM18.95 11.6h4.05v1.6h-4.05zM18.95 8.8h4.05v1.6h-4.05zM18.95 6h4.05v1.6h-4.05zM18.95 17.2h4.05v1.6h-4.05zM13.3 14.4h4.05v1.6H13.3zM13.3 11.6h4.05v1.6H13.3zM13.3 17.2h4.05v1.6H13.3zM7.65 14.4h4.05v1.6H7.65zM7.65 17.2h4.05v1.6H7.65zM2 17.2h4.05v1.6H2z" />
    </svg>
  );
}

function SpotifyMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-current">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.54.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-current">
      <path d="M17.05 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.87-.76-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.74 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.87.69 1.19-.02 1.94-1.08 2.66-2.14.84-1.23 1.19-2.42 1.2-2.48-.03-.01-2.3-.88-2.3-3.51zM14.86 5.2c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.49 2.58-1.22z" />
    </svg>
  );
}

function BandcampMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-current">
      <path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z" />
    </svg>
  );
}

function YouTubeMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 shrink-0 fill-current">
      <path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.53A3 3 0 0 0 .5 6.2C0 8.07 0 12 0 12s0 3.93.5 5.8a3 3 0 0 0 2.12 2.12c1.88.53 9.38.53 9.38.53s7.5 0 9.38-.53a3 3 0 0 0 2.12-2.12C24 15.93 24 12 24 12s0-3.93-.5-5.8zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
    </svg>
  );
}
