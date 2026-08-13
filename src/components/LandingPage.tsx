import Link from "next/link";

import { HeroCanvas } from "./HeroCanvas";

const features = [
  {
    title: "Rate & review",
    desc: "Half-star ratings from 0.5 to 5. Write a full review when words matter. Your take, precisely recorded.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    title: "Track your collection",
    desc: "Log the physical formats you own — vinyl, CD, cassette. Know exactly what's on your shelf.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      </svg>
    ),
  },
  {
    title: "Stats & insights",
    desc: "Your listening habits visualised — decades, genres, top artists. Your year in music, all in one place.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    title: "Follow friends",
    desc: "See what people you trust are listening to. Community ratings and reviews on every album page.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

const steps = [
  {
    n: "01",
    title: "Search any album",
    desc: "Find it from the full Deezer and MusicBrainz catalogues. If it was pressed, it's here.",
  },
  {
    n: "02",
    title: "Rate and review",
    desc: "Give it half-stars from 0.5 to 5. Write a review, add a date, mark the formats you own.",
  },
  {
    n: "03",
    title: "Build your profile",
    desc: "Your library grows with every log. Stats update. Friends see what you've been into.",
  },
];

export function LandingPage() {
  return (
    <div className="-mt-8">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen items-center justify-center overflow-hidden"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        <HeroCanvas className="absolute inset-0 h-full w-full" />

        {/* Gradient overlays */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{ background: "linear-gradient(to bottom, #0b0e12 0%, transparent 100%)" }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ height: "55%", background: "linear-gradient(to bottom, transparent 0%, #0b0e12 100%)" }}
        />

        <div className="relative z-10 max-w-2xl px-6 pt-14 text-center">
          <p className="text-accent-500 mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em]">
            <span className="h-px w-7 bg-current opacity-40" />
            Album logging
            <span className="h-px w-7 bg-current opacity-40" />
          </p>

          <h1 className="text-mist-100 mb-5 text-5xl leading-[1.08] font-extrabold tracking-[-0.03em] sm:text-6xl lg:text-[4.5rem]">
            Your records,{" "}
            <span className="text-accent-400">your story.</span>
          </h1>

          <p className="text-mist-400 mx-auto mb-10 max-w-md text-lg leading-relaxed">
            Rate every album you&apos;ve heard. Track your physical collection.
            Follow friends who share your taste.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="bg-accent-500 hover:bg-accent-400 text-ink-950 inline-flex items-center gap-1.5 rounded-lg px-7 py-3 text-[15px] font-bold transition-colors"
            >
              Start for free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link
              href="/login"
              className="border-ink-700 text-mist-300 hover:text-mist-100 hover:border-ink-600 inline-flex items-center rounded-lg border bg-ink-800/40 px-5 py-3 text-[15px] font-medium transition-colors"
            >
              Already a member
            </Link>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="text-mist-500 absolute bottom-8 left-1/2 flex -translate-x-1/2 animate-bounce flex-col items-center gap-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <p className="text-accent-500 mb-3 text-[11px] font-bold uppercase tracking-[0.12em]">Everything you need</p>
        <h2 className="text-mist-100 mb-3 text-4xl font-extrabold tracking-[-0.03em] leading-tight">
          Built for people who care<br className="hidden sm:block" /> about music
        </h2>
        <p className="text-mist-400 max-w-md leading-relaxed">
          Not just another list app. Wax is a full listening journal for the serious collector.
        </p>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="border-ink-800 bg-ink-900 hover:border-ink-700 rounded-xl border p-7 transition-colors"
            >
              <div className="bg-accent-500/10 text-accent-500 mb-5 flex h-10 w-10 items-center justify-center rounded-[10px]">
                {f.icon}
              </div>
              <h3 className="text-mist-100 mb-2 text-[15px] font-bold tracking-[-0.01em]">{f.title}</h3>
              <p className="text-mist-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────── */}
      <div
        className="border-ink-800 border-y py-12"
        style={{ width: "100vw", marginLeft: "calc(50% - 50vw)" }}
      >
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-8 px-4 text-center md:grid-cols-4">
          {[
            { value: "½★", label: "Rating precision" },
            { value: "∞", label: "Albums in the catalogue" },
            { value: "3+", label: "Physical formats tracked" },
            { value: "1×", label: "Home for your taste" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-accent-500 mb-1.5 text-3xl font-black leading-none tracking-[-0.04em]">
                {s.value}
              </div>
              <div className="text-mist-500 text-[11px] font-medium uppercase tracking-[0.04em]">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <p className="text-accent-500 mb-3 text-[11px] font-bold uppercase tracking-[0.12em]">How it works</p>
        <h2 className="text-mist-100 mb-3 text-4xl font-extrabold tracking-[-0.03em] leading-tight">
          Log an album in under a minute
        </h2>
        <p className="text-mist-400 max-w-sm leading-relaxed">
          No setup. Search any record, rate it, move on.
        </p>

        <div className="border-ink-800 bg-ink-900 mt-12 overflow-hidden rounded-2xl border">
          <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-ink-800">
            {steps.map((s) => (
              <div key={s.n} className="p-10">
                <div
                  className="text-accent-500 mb-4 text-5xl font-black leading-none tracking-[-0.04em]"
                  style={{ opacity: 0.18 }}
                >
                  {s.n}
                </div>
                <h3 className="text-mist-100 mb-2 text-base font-bold tracking-[-0.01em]">{s.title}</h3>
                <p className="text-mist-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pb-24 text-center">
        <p className="text-accent-500 mb-3 text-[11px] font-bold uppercase tracking-[0.12em]">Join Wax</p>
        <h2 className="text-mist-100 mx-auto mb-3 max-w-lg text-4xl font-extrabold tracking-[-0.03em] leading-tight">
          Start logging your music today
        </h2>
        <p className="text-mist-400 mx-auto mb-10 max-w-sm leading-relaxed">
          Free, forever. No ads. Your catalogue, your way.
        </p>
        <Link
          href="/register"
          className="bg-accent-500 hover:bg-accent-400 text-ink-950 inline-flex items-center gap-1.5 rounded-lg px-8 py-3.5 text-base font-bold transition-colors"
        >
          Create your account
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </Link>
      </section>
    </div>
  );
}
