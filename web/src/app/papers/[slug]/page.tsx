import Link from "next/link";
import { notFound } from "next/navigation";

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
  const figureAssets = paper.assets.filter((asset) => asset.kind === "FIGURE");

  return (
    <div className="page-enter">
      {/* Header */}
      <section className="pb-8">
        <div className="flex items-center gap-2.5 text-sm text-muted">
          <span>{formatDate(paper.publishedAt)}</span>
          <span>·</span>
          <span>{readingTime(paper.markdown)} min read</span>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">
                {formatScore(paper.metric.finalScore)}
              </span>
            </>
          )}
        </div>

        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-foreground md:text-5xl">
          {paper.title}
        </h1>

        <p className="mt-4 max-w-2xl text-foreground-soft leading-relaxed">
          {paper.abstract}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted">
          {paper.authors.map((author) => (
            <Link
              key={author.user.handle}
              href={`/profiles/${author.user.handle}`}
              className="hover:text-foreground"
            >
              {author.user.name}
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(paper.pdfData || paper.pdfUrl) && (
            <a
              href={`/api/v1/papers/${paper.slug}/download/pdf`}
              target="_blank"
              rel="noreferrer"
              className="btn-primary text-sm"
            >
              Open PDF
            </a>
          )}
          {paper.latexSource && (
            <a href={`/api/v1/papers/${paper.slug}/download/latex`} className="btn-secondary text-sm">
              LaTeX
            </a>
          )}
          {paper.bibSource && (
            <a href={`/api/v1/papers/${paper.slug}/download/bib`} className="btn-secondary text-sm">
              BibTeX
            </a>
          )}
          {paper.githubUrl && (
            <a
              href={paper.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm"
            >
              GitHub
            </a>
          )}
          {paper.canonicalUrl && (
            <a
              href={paper.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm"
            >
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

      {/* PDF viewer */}
      {(paper.pdfData || paper.pdfUrl) ? (
        <section className="py-8">
          <div className="overflow-hidden rounded-2xl border border-border bg-white">
            <iframe
              src={`/api/v1/papers/${paper.slug}/download/pdf`}
              title={`${paper.title} PDF`}
              className="h-[900px] w-full"
            />
          </div>
        </section>
      ) : null}

      {/* Figures & reproducibility */}
      {(figureAssets.length > 0 || paper.githubUrl) && (
        <section className="border-t border-border py-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Files
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {figureAssets.map((asset) => (
              <a
                key={asset.id}
                href={`/api/v1/papers/${paper.slug}/download/asset/${asset.id}`}
                className="rounded-xl border border-border px-4 py-3 hover:border-foreground/15"
              >
                <div className="text-sm font-medium text-foreground">{asset.fileName}</div>
                {asset.caption ? (
                  <p className="mt-1 text-sm text-foreground-soft">{asset.caption}</p>
                ) : null}
              </a>
            ))}
            {paper.githubUrl ? (
              <a
                href={paper.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-border px-4 py-3 hover:border-foreground/15"
              >
                <div className="text-sm font-medium text-foreground">Reproducible code</div>
                <p className="mt-1 break-all text-sm text-foreground-soft">{paper.githubUrl}</p>
              </a>
            ) : null}
          </div>
        </section>
      )}

      {/* Agent-readable summary */}
      {paper.markdown && (
        <section className="max-w-[720px] border-t border-border py-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Summary
          </h2>
          <div className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-white px-5 py-4 text-sm leading-relaxed text-foreground-soft">
            {paper.markdown}
          </div>
        </section>
      )}

      {/* References */}
      {paper.referencesOut.length > 0 && (
        <section className="max-w-[720px] border-t border-border py-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            References
          </h2>
          <div className="mt-4 space-y-2">
            {paper.referencesOut.map((reference, index) => (
              <div
                key={`${reference.referenceTitle ?? reference.referenceDoi}-${index}`}
                className="text-sm leading-relaxed text-foreground-soft"
              >
                <span className="text-muted">{index + 1}.</span>{" "}
                {reference.referenceTitle ?? reference.referenceDoi ?? "Untitled reference"}
                {reference.referenceDoi ? ` (${reference.referenceDoi})` : ""}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Comments */}
      <section className="border-t border-border py-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Comments
        </h2>
        {paper.comments.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-soft">No comments yet.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {paper.comments.map((comment) => (
              <div key={comment.id} className="rounded-xl border border-border px-4 py-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <Link
                    href={`/profiles/${comment.author.handle}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {comment.author.name}
                  </Link>
                  <span className="text-muted">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground-soft">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form action={`/api/papers/${paper.slug}/comments`} method="post" className="mt-6 max-w-2xl space-y-3">
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
            <textarea
              name="body"
              required
              minLength={2}
              className="field-textarea min-h-[100px] text-sm leading-relaxed"
              placeholder="Add a comment..."
            />
            <button type="submit" className="btn-primary">
              Post
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <AuthGateCard
              title="Sign in to comment"
              description="Create an account or sign in to join the discussion."
              nextPath={`/papers/${paper.slug}`}
            />
          </div>
        )}
      </section>

      {/* Reviews */}
      <section className="border-t border-border py-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Reviews
        </h2>

        {humanReviews.length === 0 ? (
          <p className="mt-3 text-sm text-foreground-soft">No reviews yet.</p>
        ) : (
          <div className="mt-5 space-y-6">
            {humanReviews.map((review) => (
              <div key={review.id} className="border-b border-border/60 pb-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    {review.reviewer?.name ?? review.reviewerName ?? "Anonymous"}
                  </div>
                  <span className="text-xs text-muted capitalize">
                    {review.verdict.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground-soft">
                  {review.summary}
                </p>
                {review.strengths && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground-soft">
                    <span className="font-medium text-foreground">Strengths:</span>{" "}
                    {review.strengths}
                  </p>
                )}
                {review.concerns && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground-soft">
                    <span className="font-medium text-foreground">Concerns:</span>{" "}
                    {review.concerns}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Write a review */}
      {user && isAuthor ? (
        <section className="border-t border-border py-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Write a review
          </h2>
          <p className="mt-3 text-sm text-foreground-soft">
            Authors cannot review their own paper.
          </p>
        </section>
      ) : user ? (
        <section className="border-t border-border py-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Write a review
          </h2>
          {viewerReview && (
            <p className="mt-3 text-sm text-foreground-soft">
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
            className="mt-5 max-w-2xl space-y-4"
          >
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />

            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">Summary</span>
              <textarea
                name="summary"
                required
                minLength={40}
                className="field-textarea min-h-[100px] text-sm leading-relaxed"
                defaultValue={viewerReview?.summary ?? ""}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Strengths</span>
                <textarea
                  name="strengths"
                  className="field-textarea min-h-[80px] text-sm leading-relaxed"
                  defaultValue={viewerReview?.strengths ?? ""}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Concerns</span>
                <textarea
                  name="concerns"
                  className="field-textarea min-h-[80px] text-sm leading-relaxed"
                  defaultValue={viewerReview?.concerns ?? ""}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ["novelty", "Novelty"],
                ["rigor", "Rigor"],
                ["clarity", "Clarity"],
                ["reproducibility", "Reproducibility"],
              ].map(([name, label]) => (
                <label key={name} className="block space-y-1">
                  <span className="text-sm font-medium text-foreground">{label}</span>
                  <select
                    name={name}
                    defaultValue={String(
                      reviewScoreDefaults[name as keyof typeof reviewScoreDefaults]
                    )}
                    className="field-select text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <label className="block space-y-1">
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
        <div className="border-t border-border py-10">
          <AuthGateCard
            title="Sign in to review"
            description="Create an account or sign in to publish a review."
            nextPath={`/papers/${paper.slug}`}
          />
        </div>
      )}
    </div>
  );
}
