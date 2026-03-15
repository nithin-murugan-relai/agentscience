import Link from "next/link";

import type { PaperWithRelations } from "@/lib/papers";
import { formatDate, formatScore, readingTime } from "@/lib/utils";

function breakdownValue(score: number | null | undefined) {
  return Math.round((score ?? 0) * 100);
}

export function PaperCard({
  paper,
  variant = "default",
}: {
  paper: PaperWithRelations;
  variant?: "default" | "feature";
}) {
  const isFeature = variant === "feature";

  return (
    <article
      className={`glass-panel rounded-[2rem] ${
        isFeature ? "p-7 md:p-8" : "p-6"
      }`}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-border bg-surface-muted px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {paper.origin.toLowerCase()}
            </span>
            <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
              {paper.metric?.reviewCount ?? 0} public reviews
            </span>
          </div>

          <Link href={`/papers/${paper.slug}`} className="group block">
            <h3
              className={`mt-4 text-balance text-2xl text-foreground transition-colors group-hover:text-accent ${
                isFeature ? "md:text-4xl" : "md:text-3xl"
              }`}
            >
              {paper.title}
            </h3>
          </Link>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-foreground-soft md:text-base">
            {paper.abstract}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-foreground-soft">
            <span>
              {paper.authors.map((author) => author.user.name).join(", ")}
            </span>
            <span className="text-border">/</span>
            <span>{formatDate(paper.publishedAt)}</span>
            <span className="text-border">/</span>
            <span>{readingTime(paper.markdown)} min read</span>
          </div>
        </div>

        <div className="min-w-[128px] rounded-[1.5rem] border border-border bg-surface-strong p-4 text-right">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            Final score
          </div>
          <div className="mt-2 font-display text-4xl leading-none text-foreground">
            {formatScore(paper.metric?.finalScore)}
          </div>
          <div className="mt-2 text-xs leading-6 text-foreground-soft">
            Human {breakdownValue(paper.metric?.humanScore)} / Graph{" "}
            {breakdownValue(paper.metric?.networkScore)} / AI{" "}
            {breakdownValue(paper.metric?.aiScore)}
          </div>
        </div>
      </div>

      {paper.keywords.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {paper.keywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground-soft"
            >
              {keyword}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[
          {
            label: "Human review",
            value: breakdownValue(paper.metric?.humanScore),
          },
          {
            label: "Network position",
            value: breakdownValue(paper.metric?.networkScore),
          },
          {
            label: "AI judge",
            value: breakdownValue(paper.metric?.aiScore),
          },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.25rem] bg-surface-muted p-4">
            <div className="flex items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] text-muted">
              <span>{item.label}</span>
              <span>{item.value}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-background-strong">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0d6b59,#bf8b30)]"
                style={{ width: `${item.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
