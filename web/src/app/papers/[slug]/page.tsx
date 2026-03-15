import Link from "next/link";
import { notFound } from "next/navigation";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AuthGateCard } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth";
import { getPaperBySlug } from "@/lib/papers";
import { formatDate, formatScore, readingTime } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";

export default async function PaperDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const [paper, user] = await Promise.all([getPaperBySlug(slug), getCurrentUser()]);

  if (!paper) {
    notFound();
  }

  const isSaved = user
    ? paper.saves.some((save) => save.userId === user.id)
    : false;

  return (
    <div className="space-y-8">
      <section className="glass-panel rounded-[2.5rem] p-8 md:p-10">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-border bg-surface-muted px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {paper.origin.toLowerCase()}
          </span>
          <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
            final {formatScore(paper.metric?.finalScore)}
          </span>
          <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {paper.metric?.reviewCount ?? 0} public reviews
          </span>
        </div>

        <h1 className="mt-5 max-w-5xl text-balance text-5xl leading-none text-foreground md:text-7xl">
          {paper.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-foreground-soft">
          <span>{paper.authors.map((author) => author.user.name).join(", ")}</span>
          <span className="text-border">/</span>
          <span>{formatDate(paper.publishedAt)}</span>
          <span className="text-border">/</span>
          <span>{readingTime(paper.markdown)} min read</span>
        </div>

        <p className="mt-6 max-w-4xl text-lg leading-9 text-foreground-soft">
          {paper.abstract}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {paper.pdfUrl ? (
            <Link
              href={paper.pdfUrl}
              className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
            >
              Open PDF
            </Link>
          ) : null}
          {paper.canonicalUrl ? (
            <Link
              href={paper.canonicalUrl}
              className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground-soft hover:border-accent hover:text-accent"
            >
              Canonical source
            </Link>
          ) : null}
          {user ? (
            <form action={`/api/papers/${paper.slug}/save`} method="post">
              <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
              <button
                type="submit"
                className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground-soft hover:border-accent hover:text-accent"
              >
                {isSaved ? "Saved" : "Save paper"}
              </button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground-soft hover:border-accent hover:text-accent"
            >
              Sign in to save
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.72fr_0.28fr]">
        <article className="glass-panel rounded-[2.5rem] p-8 md:p-10">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
            Full paper
          </div>
          <div className="prose-paper mt-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{paper.markdown}</ReactMarkdown>
          </div>
        </article>

        <aside className="space-y-6">
          <div className="glass-panel rounded-[2rem] p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Score breakdown
            </div>
            <div className="mt-5 space-y-4">
              {[
                ["Human review", paper.metric?.humanScore ?? 0],
                ["Graph signal", paper.metric?.networkScore ?? 0],
                ["AI judge", paper.metric?.aiScore ?? 0],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="flex items-center justify-between gap-4 text-sm text-foreground-soft">
                    <span>{label}</span>
                    <span>{Math.round(Number(value) * 100)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-background-strong">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#0d6b59,#bf8b30)]"
                      style={{ width: `${Math.round(Number(value) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[1.5rem] bg-surface-muted p-4 text-sm leading-7 text-foreground-soft">
              {paper.metric?.aiSummary ??
                "No AI summary yet. If an OpenAI key is configured, the judge will write a public assessment here."}
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Note trail
            </div>
            <div className="mt-4 space-y-4">
              {paper.ideas.length === 0 ? (
                <p className="text-sm leading-7 text-foreground-soft">
                  No note trail attached yet.
                </p>
              ) : (
                paper.ideas.map((idea) => (
                  <div key={idea.id} className="rounded-[1.5rem] bg-surface-muted p-4">
                    <div className="text-sm font-semibold text-foreground">
                      {idea.author.name}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-foreground-soft">
                      {idea.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-panel rounded-[2rem] p-6">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
              Reviews
            </div>
            <div className="mt-4 space-y-4">
              {paper.reviews.length === 0 ? (
                <p className="text-sm leading-7 text-foreground-soft">
                  No reviews yet.
                </p>
              ) : (
                paper.reviews.map((review) => (
                  <article key={review.id} className="rounded-[1.5rem] bg-surface-muted p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          {review.reviewer?.name ?? review.reviewerName ?? "Anonymous reviewer"}
                        </div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                          {review.kind.toLowerCase()} / {review.verdict.toLowerCase().replace(/_/g, " ")}
                        </div>
                      </div>
                      <div className="text-right text-xs leading-6 text-foreground-soft">
                        <div>N {review.novelty}</div>
                        <div>R {review.rigor}</div>
                        <div>C {review.clarity}</div>
                        <div>Rep {review.reproducibility}</div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-foreground-soft">
                      {review.summary}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>

      {user ? (
        <section className="glass-panel rounded-[2.5rem] p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
            Review this paper
          </div>
          <h2 className="mt-4 text-4xl text-foreground">Leave a structured review</h2>
          {error ? (
            <div className="mt-5 rounded-[1.5rem] border border-red-900/10 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <form
            action={`/api/papers/${paper.slug}/reviews`}
            method="post"
            className="mt-8 grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">Summary</span>
              <textarea
                name="summary"
                required
                minLength={40}
                className="min-h-[140px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Strengths</span>
              <textarea
                name="strengths"
                className="min-h-[120px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-foreground">Concerns</span>
              <textarea
                name="concerns"
                className="min-h-[120px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              />
            </label>
            {[
              ["novelty", "Novelty"],
              ["rigor", "Rigor"],
              ["clarity", "Clarity"],
              ["reproducibility", "Reproducibility"],
            ].map(([name, label]) => (
              <label key={name} className="space-y-2">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <select
                  name={name}
                  defaultValue="4"
                  className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-foreground">Verdict</span>
              <select
                name="verdict"
                defaultValue="ENDORSE"
                className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              >
                <option value="STRONG_ENDORSE">Strong endorse</option>
                <option value="ENDORSE">Endorse</option>
                <option value="MIXED">Mixed</option>
                <option value="CONCERN">Concern</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
              >
                Publish review
              </button>
            </div>
          </form>
        </section>
      ) : (
        <AuthGateCard
          title="Review this paper"
          description="Sign in to leave a structured review. Reviews are public and directly feed the ranking model."
        />
      )}
    </div>
  );
}
