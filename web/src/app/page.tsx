import Link from "next/link";

import { DesktopDownloadLinks } from "@/components/desktop-download-links";
import { AgentScienceWorkspaceDemo } from "@/components/home/agent-science-workspace-demo";
import { getPaperFeedPage, type PaperFeedPage } from "@/lib/papers";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMPTY_FEED: PaperFeedPage = {
  papers: [],
  page: 1,
  limit: 3,
  total: 0,
  hasMore: false,
  query: "",
};

const WORKFLOWS = [
  {
    step: "01",
    title: "Synthesize literature into a research direction.",
    body:
      "AgentScience starts from the materials scientists actually use: papers, citations, figures, and the unresolved questions between them.",
    detail: "New Paper / Literature review / Citations",
  },
  {
    step: "02",
    title: "Interpret biological datasets in context.",
    body:
      "Open scientific datasets become part of the workspace, so generated analyses can be tied back to cohorts, metadata, and source records.",
    detail: "Dataset registry / Figures / Source data",
  },
  {
    step: "03",
    title: "Create a paper-shaped output.",
    body:
      "The output is a structured paper with figures, citations, synthesized interpretations, artifacts, and a public page others can inspect.",
    detail: "Paper feed / Artifacts / Public URL",
  },
] as const;

export default async function HomePage() {
  const feed = await getPaperFeedPage({ page: 1, limit: 3 }).catch(() => EMPTY_FEED);

  return (
    <div className="page-enter -mx-[var(--page-gutter)] -my-12 md:-my-20">
      <section className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] pb-14 pt-14 sm:pb-18 sm:pt-20 md:pb-20">
        <div className="mx-auto max-w-[820px] text-center">
          <p className="home-fade-up text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
            Open-source scientific environment
          </p>
          <h1
            className="home-fade-up mt-5 text-[2.75rem] leading-[1.04] text-ink [text-wrap:balance] sm:text-[4rem] md:text-[4.75rem]"
            style={{ animationDelay: "80ms" }}
          >
            Create, publish, and share research.
          </h1>
          <p
            className="home-fade-up mx-auto mt-5 max-w-[680px] text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]"
            style={{ animationDelay: "160ms" }}
          >
            AgentScience synthesizes scientific literature and biological
            datasets into structured research papers with figures, citations,
            and synthesized interpretations.
          </p>
          <div
            className="home-fade-up mt-9 flex flex-col items-center gap-4"
            style={{ animationDelay: "240ms" }}
          >
            <DesktopDownloadLinks />
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-light">
              <a
                href="https://github.com/vineet-reddy/agentscience"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink"
              >
                Contribute on GitHub
              </a>
              <Link href="/papers" className="hover:text-ink">
                Browse papers
              </Link>
              <Link href="/datasets" className="hover:text-ink">
                Explore datasets
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <AgentScienceWorkspaceDemo />
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-[var(--page-width)] grid-cols-1 px-[var(--page-gutter)] lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-rule py-12 lg:border-b-0 lg:border-r lg:pr-12">
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
              How it fits together
            </p>
            <h2 className="mt-3 text-2xl font-medium leading-tight text-ink sm:text-3xl">
              Built around how scientists evaluate research.
            </h2>
          </div>

          <div className="lg:pl-12">
            {WORKFLOWS.map((workflow) => (
              <article
                key={workflow.step}
                className="grid gap-5 border-b border-rule py-8 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(180px,260px)] sm:items-start"
              >
                <div className="font-[family-name:var(--font-mono)] text-sm text-ink-faint">
                  {workflow.step}
                </div>
                <div>
                  <h3 className="text-base font-medium leading-snug text-ink">
                    {workflow.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-light">
                    {workflow.body}
                  </p>
                </div>
                <p className="font-[family-name:var(--font-mono)] text-xs leading-relaxed text-ink-faint sm:text-right">
                  {workflow.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto grid max-w-[var(--page-width)] gap-10 px-[var(--page-gutter)] py-14 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:py-18">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
              Public platform
            </p>
            <h2 className="mt-3 text-2xl font-medium leading-tight text-ink sm:text-3xl">
              The front page is no longer just a feed.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-light">
              Papers and datasets remain browseable, searchable records. The
              homepage now explains that those papers were generated with
              AgentScience itself, and why the app exists.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/papers" className="btn-secondary">
                View papers
              </Link>
              <Link href="/datasets" className="btn-secondary">
                View datasets
              </Link>
            </div>
          </div>

          <div className="border-t border-rule">
            {feed.papers.length > 0 ? (
              feed.papers.map((paper) => (
                <Link
                  key={paper.id}
                  href={`/papers/${paper.slug}`}
                  className="group block border-b border-rule py-5"
                >
                  <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink transition-colors group-hover:text-accent [text-wrap:balance]">
                    {paper.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-light">
                    {paper.abstract}
                  </p>
                  <p className="mt-2 text-xs text-ink-faint">
                    {paper.authors.map((author) => author.user.name).join(", ")}
                    <span className="px-2 text-rule">&middot;</span>
                    {formatDate(paper.publishedAt)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="border-b border-rule py-8 text-sm text-ink-light">
                Published papers will appear here as the public record grows.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-16 text-center md:py-20">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-normal leading-tight text-ink sm:text-5xl">
            Build the workspace with us.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-ink-light sm:text-base">
            AgentScience is fully open source. Download the app, inspect the
            code, and help shape the scientific workflows the platform supports.
          </p>
          <div className="mt-8">
            <DesktopDownloadLinks />
          </div>
        </div>
      </section>
    </div>
  );
}
