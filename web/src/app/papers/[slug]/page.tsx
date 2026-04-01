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
      <section className="border-b border-border/50 pb-10">
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{formatDate(paper.publishedAt)}</span>
          <span>·</span>
          <span>{readingTime(paper.markdown)} min indexed text</span>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <>
              <span>·</span>
              <span className="font-medium text-foreground">
                Score {formatScore(paper.metric.finalScore)}
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

        <div className="mt-5 flex flex-wrap gap-3 text-sm text-muted">
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

        <div className="mt-6 flex flex-wrap items-center gap-3">
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
              Download LaTeX
            </a>
          )}
          {paper.bibSource && (
            <a href={`/api/v1/papers/${paper.slug}/download/bib`} className="btn-secondary text-sm">
              Download BibTeX
            </a>
          )}
          {paper.githubUrl && (
            <a
              href={paper.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm"
            >
              GitHub source
            </a>
          )}
          {paper.canonicalUrl && (
            <a
              href={paper.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm"
            >
              Canonical source
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

      <section className="py-12">
        {(paper.pdfData || paper.pdfUrl) ? (
          <div className="overflow-hidden rounded-[28px] border border-border/60 bg-surface shadow-[0_24px_90px_rgba(10,15,26,0.08)]">
            <div className="border-b border-border/60 px-5 py-4 text-sm text-foreground-soft">
              Academic document view
            </div>
            <iframe
              src={`/api/v1/papers/${paper.slug}/download/pdf`}
              title={`${paper.title} PDF`}
              className="h-[900px] w-full bg-white"
            />
          </div>
        ) : (
          <div className="rounded-[28px] border border-border/60 bg-surface px-6 py-6 text-sm text-foreground-soft">
            This paper does not have a compiled PDF yet.
          </div>
        )}
      </section>

      {(figureAssets.length > 0 || paper.githubUrl || paper.bibSource) && (
        <section className="border-t border-border/50 pt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Files and reproducibility
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {figureAssets.map((asset) => (
              <a
                key={asset.id}
                href={`/api/v1/papers/${paper.slug}/download/asset/${asset.id}`}
                className="rounded-2xl border border-border/60 bg-surface px-4 py-4 hover:border-foreground/20"
              >
                <div className="text-sm font-medium text-foreground">{asset.fileName}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                  Figure
                </div>
                {asset.caption ? (
                  <p className="mt-2 text-sm text-foreground-soft">{asset.caption}</p>
                ) : null}
              </a>
            ))}
            {paper.githubUrl ? (
              <a
                href={paper.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-border/60 bg-surface px-4 py-4 hover:border-foreground/20"
              >
                <div className="text-sm font-medium text-foreground">Reproducible code</div>
                <p className="mt-2 break-all text-sm text-foreground-soft">{paper.githubUrl}</p>
              </a>
            ) : null}
          </div>
        </section>
      )}

      {paper.markdown && (
        <section className="max-w-[760px] border-t border-border/50 pt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Agent-readable summary
          </h2>
          <div className="mt-5 whitespace-pre-wrap rounded-2xl border border-border/60 bg-surface px-5 py-5 text-sm leading-relaxed text-foreground-soft">
            {paper.markdown}
          </div>
        </section>
      )}

      {paper.referencesOut.length > 0 && (
        <section className="max-w-[760px] border-t border-border/50 pt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            References
          </h2>
          <div className="mt-6 space-y-3">
            {paper.referencesOut.map((reference, index) => (
              <div
                key={`${reference.referenceTitle ?? reference.referenceDoi}-${index}`}
                className="text-sm leading-relaxed text-foreground-soft"
              >
                <span className="font-medium text-foreground">{index + 1}.</span>{" "}
                {reference.referenceTitle ?? reference.referenceDoi ?? "Untitled reference"}
                {reference.referenceDoi ? ` (${reference.referenceDoi})` : ""}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border/50 pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Comments
        </h2>
        {paper.comments.length === 0 ? (
          <p className="mt-4 text-foreground-soft">No comments yet.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {paper.comments.map((comment) => (
              <div key={comment.id} className="rounded-2xl border border-border/60 bg-surface px-5 py-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <Link
                    href={`/profiles/${comment.author.handle}`}
                    className="font-medium text-foreground hover:text-accent"
                  >
                    {comment.author.name}
                  </Link>
                  <span className="text-muted">{formatDate(comment.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground-soft">
                  {comment.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {user ? (
          <form action={`/api/papers/${paper.slug}/comments`} method="post" className="mt-6 max-w-2xl space-y-4">
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Add comment</span>
              <textarea
                name="body"
                required
                minLength={2}
                className="field-textarea min-h-[120px] text-sm leading-relaxed"
                placeholder="Discuss the paper, methods, limitations, or follow-up experiments."
              />
            </label>
            <button type="submit" className="btn-primary">
              Post comment
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

      <section className="border-t border-border/50 pt-12">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Reviews
        </h2>

        {humanReviews.length === 0 ? (
          <p className="mt-4 text-foreground-soft">No reviews yet.</p>
        ) : (
          <div className="mt-6 space-y-8">
            {humanReviews.map((review) => (
              <div key={review.id} className="border-b border-border/40 pb-8">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">
                    {review.reviewer?.name ?? review.reviewerName ?? "Anonymous"}
                  </div>
                  <span className="text-xs capitalize text-muted">
                    {review.verdict.toLowerCase().replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-foreground-soft">
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

      {user && isAuthor ? (
        <section className="mt-4 border-t border-border/50 pt-12">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Write a review
          </h2>
          <div className="mt-4 rounded-xl border border-border/70 bg-surface px-4 py-4 text-sm text-foreground-soft">
            Authors cannot review their own paper.
          </div>
        </section>
      ) : user ? (
        <section className="mt-4 border-t border-border/50 pt-12">
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
            className="mt-6 max-w-2xl space-y-5"
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
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
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
        <div className="mt-4 border-t border-border/50 pt-12">
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
