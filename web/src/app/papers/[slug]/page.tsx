import Link from "next/link";
import { notFound } from "next/navigation";

import { PaperBundleViewer } from "@/components/code-viewer/paper-bundle-viewer";
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
  const bundleArtifacts = paper.artifacts.map((artifact) => ({
    id: artifact.id,
    kind: artifact.kind,
    path: artifact.path,
    contentType: artifact.contentType,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    downloadUrl: `/api/v1/papers/${paper.slug}/download/artifact/${artifact.id}`,
    textContent: artifact.textContent,
  }));
  const bundleFigures = figureAssets.map((asset) => ({
    id: asset.id,
    fileName: asset.fileName,
    caption: asset.caption ?? null,
    downloadUrl: `/api/v1/papers/${paper.slug}/download/asset/${asset.id}`,
    mimeType: asset.mimeType,
  }));
  const requestedTab =
    typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : undefined;
  const initialBundleTab =
    requestedTab === "code" || requestedTab === "figures" || requestedTab === "pdf"
      ? requestedTab
      : bundleArtifacts.length > 0
        ? "code"
        : paper.pdfData || paper.pdfUrl
          ? "pdf"
          : "figures";
  const hasBundle =
    bundleArtifacts.length > 0 || bundleFigures.length > 0 || Boolean(paper.pdfData || paper.pdfUrl);

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
          {hasBundle ? (
            <a href="#bundle" className="btn-secondary text-sm">
              Code Viewer
            </a>
          ) : null}
          {paper.githubUrl && (
            <a
              href={paper.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-sm"
            >
              Source
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

      {hasBundle ? (
        <PaperBundleViewer
          artifacts={bundleArtifacts}
          figures={bundleFigures}
          pdfUrl={
            paper.pdfData || paper.pdfUrl
              ? `/api/v1/papers/${paper.slug}/download/pdf`
              : null
          }
          paperTitle={paper.title}
          initialTab={initialBundleTab}
        />
      ) : null}

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
          <form action={`/api/papers/${paper.slug}/comments`} method="post" className="mt-5 max-w-2xl">
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
            <textarea
              name="body"
              required
              minLength={2}
              className="field-textarea min-h-[80px] text-sm leading-relaxed"
              placeholder="Add a comment..."
            />
            <button type="submit" className="btn-primary mt-2">
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
            Review
          </h2>
          <p className="mt-2 text-sm text-foreground-soft">
            Authors cannot review their own paper.
          </p>
        </section>
      ) : user ? (
        <section className="border-t border-border py-10">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Review
          </h2>
          {viewerReview && (
            <p className="mt-2 text-sm text-foreground-soft">
              Submitting again updates your existing review.
            </p>
          )}
          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <form
            action={`/api/papers/${paper.slug}/reviews`}
            method="post"
            className="mt-4 max-w-2xl space-y-4"
          >
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />

            <textarea
              name="summary"
              required
              minLength={40}
              className="field-textarea min-h-[80px] text-sm leading-relaxed"
              placeholder="Your review..."
              defaultValue={viewerReview?.summary ?? ""}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <textarea
                name="strengths"
                className="field-textarea min-h-[60px] text-sm leading-relaxed"
                placeholder="Strengths (optional)"
                defaultValue={viewerReview?.strengths ?? ""}
              />
              <textarea
                name="concerns"
                className="field-textarea min-h-[60px] text-sm leading-relaxed"
                placeholder="Concerns (optional)"
                defaultValue={viewerReview?.concerns ?? ""}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {[
                ["novelty", "Novelty"],
                ["rigor", "Rigor"],
                ["clarity", "Clarity"],
                ["reproducibility", "Repro"],
              ].map(([name, label]) => (
                <label key={name} className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted">{label}</span>
                  <select
                    name={name}
                    defaultValue={String(
                      reviewScoreDefaults[name as keyof typeof reviewScoreDefaults]
                    )}
                    className="field-select w-14 !h-8 text-sm"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="flex items-center gap-1.5 text-sm">
                <span className="text-muted">Verdict</span>
                <select
                  name="verdict"
                  defaultValue={viewerReview?.verdict ?? "ENDORSE"}
                  className="field-select w-auto !h-8 text-sm"
                >
                  <option value="STRONG_ENDORSE">Strong endorse</option>
                  <option value="ENDORSE">Endorse</option>
                  <option value="MIXED">Mixed</option>
                  <option value="CONCERN">Concern</option>
                </select>
              </label>
            </div>

            <button type="submit" className="btn-primary">
              {viewerReview ? "Update" : "Submit"}
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
