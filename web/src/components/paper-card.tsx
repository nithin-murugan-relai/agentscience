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
      <article className="py-5 border-b border-rule">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink group-hover:text-accent transition-colors">
            {paper.title}
          </h3>
          <p className="mt-1.5 text-sm text-ink-light leading-relaxed line-clamp-2 max-w-2xl">
            {paper.abstract}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
            <span>{paper.authors.map((author) => author.user.name).join(", ")}</span>
            <span className="text-rule">&middot;</span>
            <span>{formatDate(paper.publishedAt)}</span>
            {paper.metric?.reviewCount ? (
              <>
                <span className="text-rule">&middot;</span>
                <span>{paper.metric.reviewCount} peer reviews</span>
              </>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
