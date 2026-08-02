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
        <footer className="text-mist-400 mx-auto max-w-6xl px-4 pt-4 pb-10 text-xs">
          Album data from{" "}
          <a
            href="https://musicbrainz.org"
            className="hover:text-mist-100 underline underline-offset-2"
          >
            MusicBrainz
          </a>
          , artwork from the{" "}
          <a
            href="https://coverartarchive.org"
            className="hover:text-mist-100 underline underline-offset-2"
          >
            Cover Art Archive
          </a>
          .
        </footer>
      </body>
    </html>
  );
}
