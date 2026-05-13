import Link from "next/link";

import { DesktopDownloadLinks } from "@/components/desktop-download-links";
import { AnimatedWorkspace } from "@/components/home/animated-workspace";
import { HomeMarquee } from "@/components/home/marquee";
import { HomePillars } from "@/components/home/pillars";
import { ScrollStory } from "@/components/home/scroll-story";
import { LiveFeedTeaser } from "@/components/home/live-feed-teaser";
import { getPaperFeedPage, type PaperFeedPage } from "@/lib/papers";

export const dynamic = "force-dynamic";

const EMPTY_FEED: PaperFeedPage = {
  papers: [],
  page: 1,
  limit: 6,
  total: 0,
  hasMore: false,
  query: "",
};

export default async function HomePage() {
  const feed = await getPaperFeedPage({ page: 1, limit: 6 }).catch(() => EMPTY_FEED);

  return (
    // Break out of the SiteShell's centered max-width / vertical padding
    // so home sections can render edge-to-edge with their own rhythm.
    <div className="page-enter -mx-[var(--page-gutter)] -my-12 md:-my-20">
      {/* 1. Hero */}
      <section className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] pt-16 pb-12 text-center sm:pt-24 sm:pb-16">
        <div
          className="home-fade-up text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint"
          style={{ animationDelay: "0ms" }}
        >
          The integrated environment for science
        </div>

        <h1
          className="home-fade-up mx-auto mt-5 max-w-[820px] text-[2.5rem] leading-[1.05] text-ink [text-wrap:balance] sm:text-[3.25rem] md:text-[4rem]"
          style={{ animationDelay: "100ms" }}
        >
          Datasets, code, agents,
          <br />
          and your paper.{" "}
          <span className="italic text-accent">One workspace.</span>
        </h1>

        <p
          className="home-fade-up mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-light sm:text-[1.0625rem] [text-wrap:pretty]"
          style={{ animationDelay: "200ms" }}
        >
          AgentScience is the all-in-one desktop app for scientific research.
          Discover open data, run experiments, write code, draft your paper,
          and publish to a live public feed &mdash; with frontier AI agents in every step.
        </p>

        <div
          className="home-fade-up mt-10"
          style={{ animationDelay: "300ms" }}
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <DesktopDownloadLinks />
          </div>
          <div className="mt-6">
            <Link
              href="/papers"
              className="text-sm text-ink-light hover:text-ink"
            >
              {feed.total > 0
                ? `Browse ${feed.total} published ${feed.total === 1 ? "paper" : "papers"} →`
                : "Browse published papers →"}
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Animated workspace demo */}
      <section className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] pb-16">
        <div
          className="home-fade-up mx-auto max-w-[1100px]"
          style={{ animationDelay: "400ms" }}
        >
          <AnimatedWorkspace />
        </div>
      </section>

      {/* 3. Trust marquee */}
      <HomeMarquee />

      {/* 4. Four pillars */}
      <HomePillars />

      {/* 5. Scroll-driven story */}
      <ScrollStory />

      {/* 6. Live feed teaser */}
      {feed.papers.length > 0 ? (
        <LiveFeedTeaser papers={feed.papers} total={feed.total} />
      ) : null}

      {/* 7. Final CTA */}
      <section className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-24 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-normal text-ink sm:text-5xl">
            Open the workspace.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-ink-light">
            Free to download. Free to publish. Your data stays on your machine.
          </p>
          <div className="mt-10">
            <DesktopDownloadLinks />
          </div>
        </div>
      </section>
    </div>
  );
}
