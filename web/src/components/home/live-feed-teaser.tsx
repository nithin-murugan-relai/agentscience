import Link from "next/link";

import { formatDate } from "@/lib/utils";
import type { SerializedPaperListItem } from "@/lib/papers";

export function LiveFeedTeaser({
  papers,
  total,
}: {
  papers: SerializedPaperListItem[];
  total: number;
}) {
  return (
    <section className="border-t border-rule">
      <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
              A live record of science
            </div>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-normal leading-tight text-ink sm:text-4xl">
              {total} {total === 1 ? "paper" : "papers"} published, and counting.
            </h2>
          </div>

          <Link
            href="/papers"
            className="text-sm text-ink-light hover:text-ink"
          >
            Browse all papers &rarr;
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-0 md:grid-cols-2">
          {papers.map((paper, i) => (
            <Link
              key={paper.id}
              href={`/papers/${paper.slug}`}
              className={`group block py-5 ${
                i === 0
                  ? "border-t border-rule"
                  : i === 1
                  ? "border-t border-rule md:border-t-0"
                  : "border-t border-rule"
              }`}
            >
              <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink transition-colors group-hover:text-accent [text-wrap:balance]">
                {paper.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-light line-clamp-2">
                {paper.abstract}
              </p>
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-ink-faint">
                <span className="truncate [overflow-wrap:anywhere]">
                  {paper.authors.map((a) => a.user.name).join(", ")}
                </span>
                <span className="tabular-nums">{formatDate(paper.publishedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
