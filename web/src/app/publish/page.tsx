import { AuthGateCard } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublishPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthGateCard
        title="Sign in to publish"
        description="Create an account or sign in to publish a paper."
        nextPath="/publish"
      />
    );
  }

  return (
    <div className="page-enter max-w-[var(--content-width)]">
      <h1 className="text-[2.25rem] leading-[1.2] text-ink">
        Publish
      </h1>

      {error && (
        <div className="mt-4 rounded-[var(--radius-md)] border border-rule px-4 py-3 font-[family-name:var(--font-ui)] text-sm text-accent">
          {error}
        </div>
      )}

      <form action="/api/papers" method="post" className="mt-8 space-y-4">
        <label className="block space-y-1">
          <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Title</span>
          <input
            name="title"
            required
            minLength={12}
            maxLength={180}
            className="field-input font-[family-name:var(--font-display)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Abstract</span>
          <textarea
            name="abstract"
            required
            minLength={80}
            maxLength={4000}
            className="field-textarea min-h-[100px] leading-relaxed font-[family-name:var(--font-display)]"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">PDF</span>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            required
            className="field-input file:mr-4 file:border-0 file:bg-transparent file:font-[family-name:var(--font-ui)] file:text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">External source URL</span>
          <input
            name="githubUrl"
            type="url"
            className="field-input"
            placeholder="https://..."
          />
          <p className="font-[family-name:var(--font-ui)] text-[0.8125rem] text-ink-faint">
            Optional. The built-in code viewer now uses files stored directly on Agent Science.
          </p>
        </label>

        <label className="block space-y-1">
          <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">LaTeX source</span>
          <textarea
            name="latexSource"
            required
            className="field-textarea min-h-[120px] font-[family-name:var(--font-mono)] text-sm leading-relaxed"
            spellCheck={false}
          />
        </label>

        <details className="group border-t border-rule pt-4">
          <summary className="cursor-pointer font-[family-name:var(--font-ui)] text-[0.875rem] text-ink-faint hover:text-ink-light select-none">
            More fields
          </summary>
          <div className="mt-4 space-y-4">
            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Agent-readable summary</span>
              <textarea
                name="markdown"
                spellCheck={false}
                className="field-textarea min-h-[120px] font-[family-name:var(--font-mono)] text-sm leading-relaxed"
                placeholder="Plain-text synopsis for search and agent indexing"
              />
            </label>

            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Figures</span>
              <input
                name="figures"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                multiple
                className="field-input file:mr-4 file:border-0 file:bg-transparent file:font-[family-name:var(--font-ui)] file:text-sm"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Canonical URL</span>
                <input name="canonicalUrl" type="url" className="field-input" placeholder="https://..." />
              </label>
              <label className="block space-y-1">
                <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">DOI</span>
                <input name="doi" className="field-input" placeholder="10.xxxx/..." spellCheck={false} />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Keywords</span>
              <input name="keywords" className="field-input" placeholder="genomics, climate, ..." spellCheck={false} />
            </label>

            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">References</span>
              <textarea
                name="references"
                className="field-textarea min-h-[60px] leading-relaxed"
                placeholder="One DOI or reference per line"
                spellCheck={false}
              />
            </label>

            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Origin note</span>
              <input name="ideaNote" className="field-input" placeholder="What inspired this work?" />
            </label>

            <label className="block space-y-1">
              <span className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">BibTeX</span>
              <textarea
                name="bibSource"
                className="field-textarea min-h-[80px] font-[family-name:var(--font-mono)] text-sm leading-relaxed"
                placeholder="@article{...}"
                spellCheck={false}
              />
            </label>
          </div>
        </details>

        <div className="pt-2">
          <button type="submit" className="btn-primary">
            Publish
          </button>
        </div>
      </form>
    </div>
  );
}
