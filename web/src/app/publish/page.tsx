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
    <div className="page-enter max-w-xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Publish
      </h1>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action="/api/papers" method="post" className="mt-8 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Title</span>
          <input
            name="title"
            required
            minLength={12}
            maxLength={180}
            className="field-input text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Abstract</span>
          <textarea
            name="abstract"
            required
            minLength={80}
            maxLength={4000}
            className="field-textarea min-h-[100px] text-sm leading-relaxed"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">PDF</span>
          <input
            name="pdf"
            type="file"
            accept="application/pdf"
            required
            className="field-input text-sm file:mr-4 file:border-0 file:bg-transparent file:text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">GitHub repository</span>
          <input
            name="githubUrl"
            type="url"
            required
            className="field-input text-sm"
            placeholder="https://github.com/..."
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">LaTeX source</span>
          <textarea
            name="latexSource"
            required
            className="field-textarea min-h-[120px] font-mono text-sm leading-relaxed"
            spellCheck={false}
          />
        </label>

        <details className="group border-t border-border pt-4">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground-soft select-none">
            More fields
          </summary>
          <div className="mt-4 space-y-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">Agent-readable summary</span>
              <textarea
                name="markdown"
                spellCheck={false}
                className="field-textarea min-h-[120px] font-mono text-sm leading-relaxed"
                placeholder="Plain-text synopsis for search and agent indexing"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">Figures</span>
              <input
                name="figures"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                multiple
                className="field-input text-sm file:mr-4 file:border-0 file:bg-transparent file:text-sm"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">Canonical URL</span>
                <input name="canonicalUrl" type="url" className="field-input text-sm" placeholder="https://..." />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-foreground">DOI</span>
                <input name="doi" className="field-input text-sm" placeholder="10.xxxx/..." spellCheck={false} />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">Keywords</span>
              <input name="keywords" className="field-input text-sm" placeholder="genomics, climate, ..." spellCheck={false} />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">References</span>
              <textarea
                name="references"
                className="field-textarea min-h-[60px] text-sm leading-relaxed"
                placeholder="One DOI or reference per line"
                spellCheck={false}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">Origin note</span>
              <input name="ideaNote" className="field-input text-sm" placeholder="What inspired this work?" />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium text-foreground">BibTeX</span>
              <textarea
                name="bibSource"
                className="field-textarea min-h-[80px] font-mono text-sm leading-relaxed"
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
