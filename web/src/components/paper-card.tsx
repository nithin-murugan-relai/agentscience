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
  variant = "default",
}: {
  paper: PaperCardPaper;
  variant?: "default" | "wide";
}) {
  const authorNames = paper.authors.map((author) => author.user.name).join(", ");
  const formattedDate = formatDate(paper.publishedAt);
  const reviewCountLabel = paper.metric?.reviewCount
    ? `${paper.metric.reviewCount} ${paper.metric.reviewCount === 1 ? "review" : "reviews"}`
    : null;

  if (variant === "wide") {
    return (
      <Link href={`/papers/${paper.slug}`} className="group block">
        <article className="border-b border-rule py-5 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-10">
          <div className="min-w-0 md:pr-2">
            <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink transition-colors group-hover:text-accent [text-wrap:balance]">
              {paper.title}
            </h3>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint md:hidden">
              <span className="[overflow-wrap:anywhere]">{authorNames}</span>
              <span className="text-rule">&middot;</span>
              <span>{formattedDate}</span>
            </div>
          </div>

          <div className="hidden min-w-[8rem] items-start justify-end pt-0.5 text-right text-xs text-ink-faint md:flex">
            <span className="tabular-nums">{formattedDate}</span>
          </div>

          <p className="mt-1.5 text-sm leading-relaxed text-ink-light line-clamp-2 md:col-span-2 md:mt-2">
            {paper.abstract}
          </p>

          <p className="mt-1.5 hidden text-xs text-ink-faint [overflow-wrap:anywhere] md:col-span-2 md:block">
            {authorNames}
          </p>
        </article>
      </Link>
    );
  }

  return (
    <Link href={`/papers/${paper.slug}`} className="group block">
      <article className="border-b border-rule py-5">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink transition-colors group-hover:text-accent [text-wrap:balance]">
            {paper.title}
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-light line-clamp-2">
            {paper.abstract}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
            <span className="[overflow-wrap:anywhere]">
              {authorNames}
            </span>
            <span className="text-rule">&middot;</span>
            <span>{formattedDate}</span>
            {reviewCountLabel ? (
              <>
                <span className="text-rule">&middot;</span>
                <span>{reviewCountLabel}</span>
              </>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
}
