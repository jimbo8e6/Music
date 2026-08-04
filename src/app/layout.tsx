import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Wax — rate and review albums",
    template: "%s · Wax",
  },
  description:
    "A quiet place to log the albums you listen to, rate them out of five and write about them.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Nav />
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="text-mist-400 mx-auto max-w-6xl space-y-3 px-4 pt-4 pb-10 text-xs">
          <p>
            If you&apos;re enjoying Wax, consider{" "}
            <a
              href="https://ko-fi.com/wax_official"
              target="_blank"
              rel="noreferrer"
              className="hover:text-mist-100 underline underline-offset-2"
            >
              supporting the development
            </a>
            .
          </p>
          <p>
            Album data from{" "}
            <a
              href="https://musicbrainz.org"
              className="hover:text-mist-100 underline underline-offset-2"
            >
              MusicBrainz
            </a>{" "}
            and{" "}
            <a
              href="https://spotify.com"
              className="hover:text-mist-100 underline underline-offset-2"
            >
              Spotify
            </a>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}
