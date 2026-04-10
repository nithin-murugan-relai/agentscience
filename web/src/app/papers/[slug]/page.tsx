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
  const reviews = paper.reviews;
  const isAuthor = user ? paper.authors.some((author) => author.userId === user.id) : false;
  const viewerReview = user
    ? reviews.find((review) => review.kind === "HUMAN" && review.reviewerId === user.id)
    : undefined;
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
      <section className="pb-10 max-w-[var(--content-width)]">
        <div className="flex items-center gap-2.5 font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-faint">
          <span>{formatDate(paper.publishedAt)}</span>
          <span className="text-rule">&middot;</span>
          <span>{readingTime(paper.markdown)} min read</span>
          {paper.metric?.finalScore != null && paper.metric.finalScore > 0 && (
            <>
              <span className="text-rule">&middot;</span>
              <span className="font-[family-name:var(--font-mono)] text-ink">
                {formatScore(paper.metric.finalScore)}
              </span>
            </>
          )}
        </div>

        <h1 className="mt-4 text-[2.25rem] leading-[1.2] text-ink md:text-[2.75rem]">
          {paper.title}
        </h1>

        <p className="mt-4 text-ink-light leading-relaxed font-[family-name:var(--font-body)]">
          {paper.abstract}
        </p>

        <div className="mt-4 flex flex-wrap gap-2 font-[family-name:var(--font-ui)] text-[0.875rem] text-ink-light">
          {paper.authors.map((author) => (
            <Link
              key={author.user.handle}
              href={`/profiles/${author.user.handle}`}
              className="hover:text-ink"
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
              className="btn-primary"
            >
              Open PDF
            </a>
          )}
          {paper.latexSource && (
            <a href={`/api/v1/papers/${paper.slug}/download/latex`} className="btn-secondary">
              LaTeX
            </a>
          )}
          {paper.bibSource && (
            <a href={`/api/v1/papers/${paper.slug}/download/bib`} className="btn-secondary">
              BibTeX
            </a>
          )}
          {hasBundle ? (
            <a href="#bundle" className="btn-secondary">
              Code Viewer
            </a>
          ) : null}
          {paper.githubUrl && (
            <a
              href={paper.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Source
            </a>
          )}
          {paper.canonicalUrl && (
            <a
              href={paper.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              Source
            </a>
          )}
          {user ? (
            <form action={`/api/papers/${paper.slug}/save`} method="post">
              <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
              <button type="submit" className="btn-secondary">
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


      {/* References */}
      {paper.referencesOut.length > 0 && (
        <section className="max-w-[var(--content-width)] border-t border-rule py-10">
          <h2 className="text-[1.25rem] leading-[1.3] text-ink">
            References
          </h2>
          <div className="mt-4 space-y-2">
            {paper.referencesOut.map((reference, index) => (
              <div
                key={`${reference.referenceTitle ?? reference.referenceDoi}-${index}`}
                className="font-[family-name:var(--font-ui)] text-[0.875rem] leading-relaxed text-ink-light"
              >
                <span className="font-[family-name:var(--font-mono)] text-ink-faint">{index + 1}.</span>{" "}
                {reference.referenceTitle ?? reference.referenceDoi ?? "Untitled reference"}
                {reference.referenceDoi ? ` (${reference.referenceDoi})` : ""}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="border-t border-rule py-10">
        <h2 className="text-[1.25rem] leading-[1.3] text-ink">
          Reviews
        </h2>

        {reviews.length === 0 ? (
          <p className="mt-3 font-[family-name:var(--font-ui)] text-[0.875rem] text-ink-light">No reviews yet.</p>
        ) : (
          <div className="mt-5 space-y-0">
            {reviews.map((review) => {
              const isAi = review.kind === "AI";
              const name = isAi
                ? review.reviewerName ?? "Agent Science Judge"
                : review.reviewer?.name ?? review.reviewerName ?? "Anonymous";
              const handle = !isAi ? review.reviewer?.handle : null;
              const verdictLabel = review.verdict === "ENDORSE" ? "endorsed" : "flagged";
              const verdictClass =
                review.verdict === "ENDORSE"
                  ? "text-emerald-700"
                  : "text-amber-700";
              return (
                <div key={review.id} className="border-b border-rule py-5">
                  <div className="flex items-center justify-between gap-4 font-[family-name:var(--font-ui)] text-[0.875rem]">
                    <div className="flex items-center gap-2">
                      {handle ? (
                        <Link
                          href={`/profiles/${handle}`}
                          className="text-ink hover:text-accent"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="text-ink">{name}</span>
                      )}
                      <span className={`text-[0.8125rem] ${verdictClass}`}>{verdictLabel}</span>
                    </div>
                    <span className="text-[0.8125rem] text-ink-faint">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap font-[family-name:var(--font-body)] text-[1rem] leading-relaxed text-ink-light">
                    {review.summary}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {user && !isAuthor ? (
          <form
            action={`/api/papers/${paper.slug}/reviews`}
            method="post"
            className="mt-6 max-w-[var(--content-width)]"
          >
            <input type="hidden" name="redirectTo" value={`/papers/${paper.slug}`} />
            {error && (
              <div className="mb-3 rounded-[var(--radius-md)] border border-rule px-4 py-3 font-[family-name:var(--font-ui)] text-sm text-accent">
                {error}
              </div>
            )}
            <textarea
              name="summary"
              required
              minLength={1}
              maxLength={2000}
              className="field-textarea min-h-[80px] leading-relaxed font-[family-name:var(--font-body)]"
              placeholder="what'd you think?"
              defaultValue={viewerReview?.summary ?? ""}
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="submit"
                name="verdict"
                value="ENDORSE"
                className={`rounded-[var(--radius-sm)] border px-3 py-1.5 font-[family-name:var(--font-ui)] text-[0.875rem] transition ${
                  viewerReview?.verdict === "ENDORSE"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-rule text-ink-light hover:border-emerald-600 hover:text-emerald-700"
                }`}
              >
                holds up
              </button>
              <button
                type="submit"
                name="verdict"
                value="CONCERN"
                className={`rounded-[var(--radius-sm)] border px-3 py-1.5 font-[family-name:var(--font-ui)] text-[0.875rem] transition ${
                  viewerReview?.verdict === "CONCERN"
                    ? "border-amber-600 bg-amber-50 text-amber-700"
                    : "border-rule text-ink-light hover:border-amber-600 hover:text-amber-700"
                }`}
              >
                doesn&apos;t
              </button>
            </div>
          </form>
        ) : user && isAuthor ? (
          <p className="mt-6 font-[family-name:var(--font-ui)] text-[0.875rem] text-ink-light">
            You can&apos;t review your own paper.
          </p>
        ) : (
          <div className="mt-6">
            <AuthGateCard
              title="Sign in to review"
              description="Create an account or sign in to post a review."
              nextPath={`/papers/${paper.slug}`}
            />
          </div>
        )}
      </section>
    </div>
  );
}
