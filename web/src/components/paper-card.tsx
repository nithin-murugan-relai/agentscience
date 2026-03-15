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
      <article className="py-6 border-b border-border/60 transition-colors group-hover:border-foreground/20">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              {rank != null && (
                <span className="text-sm font-medium text-muted tabular-nums">
                  {String(rank).padStart(2, "0")}
                </span>
              )}
              <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-accent transition-colors">
                {paper.title}
              </h3>
            </div>
            <p className="mt-2 text-sm text-foreground-soft leading-relaxed line-clamp-2 max-w-2xl">
              {paper.abstract}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted">
              <span>{paper.authors.map((a) => a.user.name).join(", ")}</span>
              <span className="text-border">·</span>
              <span>{formatDate(paper.publishedAt)}</span>
              {paper.metric?.reviewCount ? (
                <>
                  <span className="text-border">·</span>
                  <span>{paper.metric.reviewCount} reviews</span>
                </>
              ) : null}
            </div>
          </div>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <div className="shrink-0 text-right">
              <div className="text-2xl font-semibold tabular-nums text-foreground">
                {formatScore(paper.metric.finalScore)}
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
