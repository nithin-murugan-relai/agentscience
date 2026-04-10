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
      <article className="py-5 border-b border-rule">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {rank != null && (
                <span className="font-[family-name:var(--font-mono)] text-sm text-ink-faint tabular-nums">
                  {String(rank).padStart(2, "0")}
                </span>
              )}
              <h3 className="font-[family-name:var(--font-display)] text-lg leading-snug text-ink group-hover:text-accent transition-colors">
                {paper.title}
              </h3>
            </div>
            <p className="mt-1.5 text-sm text-ink-light leading-relaxed line-clamp-2 max-w-2xl">
              {paper.abstract}
            </p>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
              <span>{paper.authors.map((a) => a.user.name).join(", ")}</span>
              <span className="text-rule">&middot;</span>
              <span>{formatDate(paper.publishedAt)}</span>
              {paper.metric?.reviewCount ? (
                <>
                  <span className="text-rule">&middot;</span>
                  <span>{paper.metric.reviewCount} reviews</span>
                </>
              ) : null}
            </div>
          </div>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <div className="shrink-0 pt-0.5">
              <div className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-ink">
                {formatScore(paper.metric.finalScore)}
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
