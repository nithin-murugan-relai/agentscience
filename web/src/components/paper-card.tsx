import Link from "next/link";

import type { PaperListItem } from "@/lib/papers";
import { formatDate, formatScore } from "@/lib/utils";

export function PaperCard({
  paper,
  rank,
}: {
  paper: PaperListItem;
  variant?: "default" | "feature";
  rank?: number;
}) {
  return (
    <Link href={`/papers/${paper.slug}`} className="group block">
      <article className="border-b border-rule py-5 sm:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {rank != null && (
                <span className="pt-0.5 font-[family-name:var(--font-mono)] text-sm text-ink-faint tabular-nums">
                  {String(rank).padStart(2, "0")}
                </span>
              )}
              <h3 className="font-[family-name:var(--font-display)] text-base leading-snug text-ink transition-colors group-hover:text-accent sm:text-lg [text-wrap:balance]">
                {paper.title}
              </h3>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-light line-clamp-3 sm:line-clamp-2">
              {paper.abstract}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
              <span className="[overflow-wrap:anywhere]">{paper.authors.map((a) => a.user.name).join(", ")}</span>
              <span>{formatDate(paper.publishedAt)}</span>
              {paper.metric?.reviewCount ? (
                <span>{paper.metric.reviewCount} reviews</span>
              ) : null}
            </div>
          </div>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <div className="shrink-0 self-start pt-0.5">
              <div className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink sm:text-base">
                {formatScore(paper.metric.finalScore)}
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
