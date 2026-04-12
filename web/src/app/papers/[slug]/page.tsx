import Link from "next/link";
import { notFound } from "next/navigation";

import { PaperBundleViewer } from "@/components/code-viewer/paper-bundle-viewer";
import { AuthGateCard } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth";
import {
  buildPaperBundleView,
  resolveInitialPaperBundleTab,
} from "@/lib/paper-bundle";
import { getPaperBySlug } from "@/lib/papers";
import { formatDate, pageCount } from "@/lib/utils";

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
  const bundle = buildPaperBundleView(paper, {
    includeTextContent: true,
  });
  const requestedTab =
    typeof resolvedSearchParams.tab === "string" ? resolvedSearchParams.tab : undefined;
  const initialBundleTab = resolveInitialPaperBundleTab(bundle, requestedTab);

  return (
    <div className="page-enter">
      {/* Header */}
      <section className="pb-8 max-w-[var(--content-width)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
          <span>{formatDate(paper.publishedAt)}</span>
          <span className="text-rule">&middot;</span>
          <span>{pageCount(paper.markdown)} pages</span>
          {paper.metric?.reviewCount ? (
            <>
              <span className="text-rule">&middot;</span>
              <span>{paper.metric.reviewCount} peer reviews</span>
            </>
          ) : null}
        </div>

        <h1 className="mt-3 text-[clamp(2rem,7vw,2.6rem)] leading-[1.08] text-ink [text-wrap:balance]">
          {paper.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-2 text-sm text-ink-light">
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

        <p className="mt-3 text-ink-light leading-relaxed [text-wrap:pretty] sm:line-clamp-none line-clamp-6">
          {paper.abstract}
        </p>

      </section>

      {bundle.hasBundle ? (
        <PaperBundleViewer
          artifacts={bundle.artifacts}
          figures={bundle.figures}
          pdfUrl={bundle.pdfUrl}
          paperTitle={paper.title}
          initialTab={initialBundleTab}
          latexUrl={paper.latexSource ? `/api/v1/papers/${paper.slug}/download/latex` : null}
          bibUrl={paper.bibSource ? `/api/v1/papers/${paper.slug}/download/bib` : null}
          saveAction={user ? `/api/papers/${paper.slug}/save` : null}
          isSaved={isSaved}
          redirectTo={`/papers/${paper.slug}`}
        />
      ) : null}


      {/* References */}
      {paper.referencesOut.length > 0 && (
        <section className="max-w-[var(--content-width)] border-t border-rule py-8">
          <h2 className="text-base font-medium text-ink">References</h2>
          <div className="mt-3 space-y-1.5">
            {paper.referencesOut.map((reference, index) => (
              <div
                key={`${reference.referenceTitle ?? reference.referenceDoi}-${index}`}
                className="text-sm leading-relaxed text-ink-light"
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
      <section className="max-w-[var(--content-width)] border-t border-rule py-8">
        <h2 className="text-base font-medium text-ink">Reviews</h2>

        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-ink-light">No reviews yet.</p>
        ) : (
          <div className="mt-4">
            {reviews.map((review) => {
              const isAi = review.kind === "AI";
              const name = isAi
                ? review.reviewerName ?? "AgentScience Judge"
                : review.reviewer?.name ?? review.reviewerName ?? "Anonymous";
              const handle = !isAi ? review.reviewer?.handle : null;
              const verdictLabel = review.verdict === "ENDORSE" ? "endorsed" : "flagged";
              const verdictClass =
                review.verdict === "ENDORSE"
                  ? "text-emerald-700"
                  : "text-amber-700";
              return (
                <div key={review.id} className="border-b border-rule py-4">
                  <div className="flex flex-col gap-1.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {handle ? (
                        <Link
                          href={`/profiles/${handle}`}
                          className="font-medium text-ink hover:text-accent"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{name}</span>
                      )}
                      <span className={`text-xs ${verdictClass}`}>{verdictLabel}</span>
                    </div>
                    <span className="text-xs text-ink-faint">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-light">
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
              <div className="mb-3 rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-accent">
                {error}
              </div>
            )}
            <textarea
              name="summary"
              required
              minLength={20}
              maxLength={2000}
              className="field-textarea min-h-[80px] leading-relaxed"
              placeholder="What held up? What needs work? Keep it specific."
              defaultValue={viewerReview?.summary ?? ""}
            />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs text-ink-faint">Novelty</span>
                <select
                  name="novelty"
                  className="field-select"
                  defaultValue={String(viewerReview?.novelty ?? 4)}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={`novelty-${value}`} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink-faint">Rigor</span>
                <select
                  name="rigor"
                  className="field-select"
                  defaultValue={String(viewerReview?.rigor ?? 4)}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={`rigor-${value}`} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink-faint">Clarity</span>
                <select
                  name="clarity"
                  className="field-select"
                  defaultValue={String(viewerReview?.clarity ?? 4)}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={`clarity-${value}`} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-ink-faint">Reproducibility</span>
                <select
                  name="reproducibility"
                  className="field-select"
                  defaultValue={String(viewerReview?.reproducibility ?? 4)}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <option key={`reproducibility-${value}`} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                name="verdict"
                value="ENDORSE"
                className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition ${
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
                className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-sm transition ${
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
          <p className="mt-6 text-sm text-ink-light">
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
