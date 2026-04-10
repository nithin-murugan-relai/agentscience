import Link from "next/link";

import { formatDate } from "@/lib/utils";

export type PaperCardPaper = {
  id: string;
  slug: string;
  title: string;
  abstract: string;
  publishedAt: Date | string;
  authors: Array<{
    user: {
      name: string;
    };
  }>;
  metric: {
    reviewCount: number;
  } | null;
};

export function PaperCard({
  paper,
}: {
  paper: PaperCardPaper;
}) {
  return (
    <Link href={`/papers/${paper.slug}`} className="group block">
      <article className="border-b border-rule py-5 sm:py-6">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-display)] text-base leading-snug text-ink transition-colors group-hover:text-accent sm:text-lg [text-wrap:balance]">
            {paper.title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-light line-clamp-3 sm:line-clamp-2">
            {paper.abstract}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
            <span className="[overflow-wrap:anywhere]">{paper.authors.map((author) => author.user.name).join(", ")}</span>
            <span>{formatDate(paper.publishedAt)}</span>
            {paper.metric?.reviewCount ? (
              <>
                <span>{paper.metric.reviewCount} peer reviews</span>
              </>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
