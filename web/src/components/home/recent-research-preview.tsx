import Link from "next/link";

import type { PaperFeedPage } from "@/lib/papers";
import { formatDate } from "@/lib/utils";

export function RecentResearchPreview({
  feed,
  totalCount,
}: {
  feed: PaperFeedPage;
  totalCount: number;
}) {
  const papers = feed.papers.slice(0, 4);

  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-rule pb-4">
        <h3 className="text-sm font-medium text-ink">
          Latest preprints
        </h3>
        <span className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-xs text-ink-faint">
          <span className="home-live-dot home-live-dot-sm" aria-hidden="true" />
          {totalCount} {totalCount === 1 ? "paper" : "papers"}
        </span>
      </div>

      {papers.length > 0 ? (
        <ul className="divide-y divide-rule">
          {papers.map((paper) => (
            <li key={paper.id}>
              <Link
                href={`/papers/${paper.slug}`}
                className="group block py-5 transition-[padding] duration-200 ease-out hover:pl-1.5"
              >
                <div className="flex items-baseline justify-between gap-6">
                  <h4 className="flex-1 font-[family-name:var(--font-display)] text-[1.05rem] font-normal leading-[1.3] text-ink transition-colors group-hover:text-accent [text-wrap:balance]">
                    {paper.title}
                  </h4>
                  <span className="shrink-0 font-[family-name:var(--font-mono)] text-[0.6875rem] text-ink-faint tabular-nums">
                    {formatDate(paper.publishedAt)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-relaxed text-ink-light">
                  {paper.abstract}
                </p>
                <p className="mt-2 text-xs text-ink-faint [overflow-wrap:anywhere]">
                  {paper.authors.map((author) => author.user.name).join(", ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-b border-rule py-10 text-sm text-ink-light">
          Published papers will appear here as the public record grows.
        </p>
      )}

      <div className="mt-6 flex justify-center">
        <Link
          href="/papers"
          className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
        >
          <span>
            View all {totalCount > 0 ? `${totalCount} ` : ""}papers
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M5 12h14m-5-5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
