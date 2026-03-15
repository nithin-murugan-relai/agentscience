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

  const isSaved = user ? paper.saves.some((save) => save.userId === user.id) : false;
  const humanReviews = paper.reviews.filter((review) => review.kind === "HUMAN");
  const isAuthor = user ? paper.authors.some((author) => author.userId === user.id) : false;
  const viewerReview = user
    ? humanReviews.find((review) => review.reviewerId === user.id)
    : undefined;
  const reviewScoreDefaults = {
    novelty: viewerReview?.novelty ?? 4,
    rigor: viewerReview?.rigor ?? 4,
    clarity: viewerReview?.clarity ?? 4,
    reproducibility: viewerReview?.reproducibility ?? 4,
  } as const;

  return (
    <div className="page-enter">
      {/* Header */}
      <section className="pb-10 border-b border-border/50">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{formatDate(paper.publishedAt)}</span>
          <span>·</span>
          <span>{readingTime(paper.markdown)} min read</span>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">Score {formatScore(paper.metric.finalScore)}</span>
            </>
          )}
        </div>

        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground leading-[1.1] md:text-5xl max-w-3xl">
          {paper.title}
        </h1>

        <p className="mt-4 text-foreground-soft leading-relaxed max-w-2xl">
          {paper.abstract}
        </p>

        <div className="mt-4 text-sm text-muted">
          {paper.authors.map((a) => a.user.name).join(", ")}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {paper.pdfUrl && (
            <a href={paper.pdfUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">
              Open PDF
            </a>
          )}
          {paper.canonicalUrl && (
            <a href={paper.canonicalUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
              Source
            </a>
          )}
          {user ? (
            <form action={`/api/papers/${paper.slug}/save`} method="post">
              <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
              <button type="submit" className="btn-secondary text-sm">
                {isSaved ? "Saved" : "Save"}
              </button>
            </form>
          ) : null}
        </div>
      </section>

      {/* Paper body */}
      <section className="py-12 max-w-[680px]">
        <div className="prose-paper">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{paper.markdown}</ReactMarkdown>
        </div>
      </section>

      {/* Reviews */}
      <section className="border-t border-border/50 pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Reviews
        </h2>

        {humanReviews.length === 0 ? (
          <p className="mt-4 text-foreground-soft">
            No reviews yet.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {humanReviews.map((review) => (
              <div key={review.id} className="border-b border-border/40 pb-8">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    {review.reviewer?.name ?? review.reviewerName ?? "Anonymous"}
                  </div>
                  <span className="text-xs text-muted capitalize">
                    {review.verdict.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-3 text-sm text-foreground-soft leading-relaxed">
                  {review.summary}
                </p>
                {review.strengths && (
                  <p className="mt-2 text-sm text-foreground-soft leading-relaxed">
                    <span className="font-medium text-foreground">Strengths:</span> {review.strengths}
                  </p>
                )}
                {review.concerns && (
                  <p className="mt-2 text-sm text-foreground-soft leading-relaxed">
                    <span className="font-medium text-foreground">Concerns:</span> {review.concerns}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Review form */}
      {user && isAuthor ? (
        <section className="border-t border-border/50 pt-12 mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Write a review
          </h2>
          <div className="mt-4 rounded-xl border border-border/70 bg-surface px-4 py-4 text-sm text-foreground-soft">
            Authors cannot review their own paper.
          </div>
        </section>
      ) : user ? (
        <section className="border-t border-border/50 pt-12 mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Write a review
          </h2>
          {viewerReview && (
            <p className="mt-4 text-sm text-foreground-soft">
              You already reviewed this paper. Submitting again updates your existing review.
            </p>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form
            action={`/api/papers/${paper.slug}/reviews`}
            method="post"
            className="mt-6 space-y-5 max-w-2xl"
          >
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Summary</span>
              <textarea
                name="summary"
                required
                minLength={40}
                className="field-textarea min-h-[120px] text-sm leading-relaxed"
                defaultValue={viewerReview?.summary ?? ""}
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Strengths</span>
                <textarea
                  name="strengths"
                  className="field-textarea min-h-[100px] text-sm leading-relaxed"
                  defaultValue={viewerReview?.strengths ?? ""}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-foreground">Concerns</span>
                <textarea
                  name="concerns"
                  className="field-textarea min-h-[100px] text-sm leading-relaxed"
                  defaultValue={viewerReview?.concerns ?? ""}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["novelty", "Novelty"],
                ["rigor", "Rigor"],
                ["clarity", "Clarity"],
                ["reproducibility", "Reproducibility"],
              ].map(([name, label]) => (
                <label key={name} className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <select
                    name={name}
                    defaultValue={String(
                      reviewScoreDefaults[name as keyof typeof reviewScoreDefaults]
                    )}
                    className="field-select text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Verdict</span>
              <select
                name="verdict"
                defaultValue={viewerReview?.verdict ?? "ENDORSE"}
                className="field-select text-sm"
              >
                <option value="STRONG_ENDORSE">Strong endorse</option>
                <option value="ENDORSE">Endorse</option>
                <option value="MIXED">Mixed</option>
                <option value="CONCERN">Concern</option>
              </select>
            </label>

            <button type="submit" className="btn-primary">
              {viewerReview ? "Update review" : "Submit review"}
            </button>
          </form>
        </section>
      ) : (
        <div className="border-t border-border/50 pt-12 mt-4">
          <AuthGateCard
            title="Sign in to review this paper"
            description="Create an account or sign in to publish a structured review."
            nextPath={`/papers/${paper.slug}`}
          />
        </div>
      )}
    </div>
  );
}
