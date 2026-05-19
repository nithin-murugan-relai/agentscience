import { AppShowcase } from "@/components/home/app-showcase";
import { FinalCta } from "@/components/home/final-cta";
import { GapVisualization } from "@/components/home/gap-visualization";
import { HomeHero } from "@/components/home/home-hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { RecentResearchPreview } from "@/components/home/recent-research-preview";
import { RevealSection } from "@/components/home/reveal-section";
import { getPaperFeedPage, type PaperFeedPage } from "@/lib/papers";

export const dynamic = "force-dynamic";

const EMPTY_FEED: PaperFeedPage = {
  papers: [],
  page: 1,
  limit: 4,
  total: 0,
  hasMore: false,
  query: "",
};

export default async function HomePage() {
  const feed = await getPaperFeedPage({ page: 1, limit: 4 }).catch(() => EMPTY_FEED);

  return (
    <div className="page-enter -mx-[var(--page-gutter)] -my-12 md:-my-20">
      <HomeHero />

      {/* ===== Product flow ===== */}
      <RevealSection className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-12 md:py-16">
          <h2 className="text-base font-medium text-ink">
            From idea to preprint
          </h2>
          <p className="mt-3 max-w-[680px] text-base leading-relaxed text-ink-light">
            AgentScience is the open-source path from a research question to a
            public preprint. Create rigorous science with AI agents in the app,
            publish it here, and take the work wherever you want. No copyright
            retained, no lock-in.
          </p>

          <GapVisualization />

          <div className="mt-10">
            <HowItWorks />
          </div>
        </div>
      </RevealSection>

      {/* ===== Dark app showcase ===== */}
      <RevealSection>
        <AppShowcase />
      </RevealSection>

      {/* ===== Recent research preview ===== */}
      <RevealSection className="border-t border-rule bg-surface" id="feed">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-12 md:py-16">
          <h2 className="text-base font-medium text-ink">
            Recent research
          </h2>
          <p className="mt-3 max-w-[620px] text-base leading-relaxed text-ink-light">
            Every paper here was made with the app, with its agent collaboration
            intact. Browse the latest, or dive into the full archive.
          </p>

          <div className="mt-8">
            <RecentResearchPreview feed={feed} totalCount={feed.total} />
          </div>
        </div>
      </RevealSection>

      {/* ===== Final CTA ===== */}
      <RevealSection className="border-t border-rule">
        <FinalCta />
      </RevealSection>
    </div>
  );
}
