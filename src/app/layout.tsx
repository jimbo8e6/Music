import type { Metadata, Viewport } from "next";

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
            Album data from{" "}
            <a
              href="https://musicbrainz.org"
              className="hover:text-mist-100 underline underline-offset-2"
            >
              MusicBrainz
            </a>{" "}
            and{" "}
            <a
              href="https://deezer.com"
              className="hover:text-mist-100 underline underline-offset-2"
            >
              Deezer
            </a>
            .
          </p>
        </footer>
      </body>
    </html>
  );
}
