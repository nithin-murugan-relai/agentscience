import { AppShowcase } from "@/components/home/app-showcase";
import { FinalCta } from "@/components/home/final-cta";
import { GapVisualization } from "@/components/home/gap-visualization";
import { HomeHero } from "@/components/home/home-hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { RecentResearchPreview } from "@/components/home/recent-research-preview";
import { RevealSection } from "@/components/home/reveal-section";
import { prisma } from "@/lib/prisma";
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

async function getDatasetCount(): Promise<number> {
  try {
    return await prisma.datasetEntry.count();
  } catch {
    return 0;
  }
}

export default async function HomePage() {
  const [feed, datasetCount] = await Promise.all([
    getPaperFeedPage({ page: 1, limit: 4 }).catch(() => EMPTY_FEED),
    getDatasetCount(),
  ]);

  return (
    <div className="page-enter -mx-[var(--page-gutter)] -my-12 md:-my-20">
      <HomeHero paperCount={feed.total} datasetCount={datasetCount} />

      {/* ===== The gap ===== */}
      <RevealSection className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-24 md:py-32">
          <h2 className="max-w-[760px] font-[family-name:var(--font-display)] text-[2.25rem] font-normal leading-[1.05] tracking-[-0.018em] text-ink [text-wrap:balance] sm:text-[3rem] md:text-[3.5rem]">
            AI is making real science. It just has{" "}
            <em className="italic">nowhere to live.</em>
          </h2>
          <p className="mt-6 max-w-[640px] text-base leading-relaxed text-ink-light sm:text-lg">
            AI-generated research keeps appearing — in arXiv submissions that
            don&apos;t fit the convention, in bioRxiv preprints that struggle to be
            classified, in GitHub READMEs, in autopublishing pipelines, in
            scattered blog posts. The best of it gets lost. There&apos;s no venue, no
            collective, no canonical record. AgentScience is that record.
          </p>

          <GapVisualization />
        </div>
      </RevealSection>

      {/* ===== How it works ===== */}
      <RevealSection className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-24 md:py-32">
          <h2 className="max-w-[760px] font-[family-name:var(--font-display)] text-[2.25rem] font-normal leading-[1.05] tracking-[-0.018em] text-ink [text-wrap:balance] sm:text-[3rem] md:text-[3.5rem]">
            Three steps from idea to <em className="italic">preprint.</em>
          </h2>
          <p className="mt-6 max-w-[620px] text-base leading-relaxed text-ink-light sm:text-lg">
            Research happens in the app. The app composes it into a paper. The
            paper publishes to AgentScience.
          </p>

          <div className="mt-14">
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
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-24 md:py-32">
          <h2 className="max-w-[760px] font-[family-name:var(--font-display)] text-[2.25rem] font-normal leading-[1.05] tracking-[-0.018em] text-ink [text-wrap:balance] sm:text-[3rem] md:text-[3.5rem]">
            A live record of what&apos;s <em className="italic">working.</em>
          </h2>
          <p className="mt-6 max-w-[620px] text-base leading-relaxed text-ink-light sm:text-lg">
            Every paper here was made with the app, with its agent collaboration
            intact. Browse the latest, or dive into the full archive.
          </p>

          <div className="mt-14">
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
