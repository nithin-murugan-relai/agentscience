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
    <div className="page-enter max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        Publish
      </h1>
      <p className="mt-3 text-lg text-foreground-soft">
        Share your research with the world.
      </p>

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action="/api/papers" method="post" className="mt-10 space-y-6">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Title</span>
          <input
            name="title"
            required
            minLength={12}
            maxLength={180}
            className="field-input text-sm"
            placeholder="Your paper title"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Abstract</span>
          <textarea
            name="abstract"
            required
            minLength={80}
            maxLength={4000}
            className="field-textarea min-h-[140px] text-sm leading-relaxed"
            placeholder="A brief summary of your work"
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Paper body</span>
          <textarea
            name="markdown"
            required
            minLength={300}
            spellCheck={false}
            className="field-textarea min-h-[360px] font-mono text-sm leading-relaxed"
            placeholder="Write in Markdown..."
          />
        </label>

        <div className="border-t border-border/50 pt-6">
          <h2 className="text-lg font-semibold text-foreground">Optional details</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">PDF URL</span>
              <input name="pdfUrl" type="url" className="field-input text-sm" placeholder="https://..." />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Canonical URL</span>
              <input name="canonicalUrl" type="url" className="field-input text-sm" placeholder="https://..." />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">DOI</span>
              <input name="doi" className="field-input text-sm" placeholder="10.xxxx/..." spellCheck={false} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Keywords</span>
              <input name="keywords" className="field-input text-sm" placeholder="genomics, climate, ..." spellCheck={false} />
            </label>
          </div>

          <label className="mt-5 block space-y-1.5">
            <span className="text-sm font-medium text-foreground">References</span>
            <textarea
              name="references"
              className="field-textarea min-h-[90px] text-sm leading-relaxed"
              placeholder="One DOI or reference per line"
              spellCheck={false}
            />
          </label>

          <label className="mt-5 block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Origin note</span>
            <textarea
              name="ideaNote"
              className="field-textarea min-h-[90px] text-sm leading-relaxed"
              placeholder="What inspired this work?"
            />
          </label>

          <label className="mt-5 block space-y-1.5">
            <span className="text-sm font-medium text-foreground">LaTeX source</span>
            <textarea
              name="latexSource"
              className="field-textarea min-h-[120px] font-mono text-sm leading-relaxed"
              placeholder="Optional LaTeX source"
              spellCheck={false}
            />
          </label>
        </div>

        <div className="pt-2">
          <button type="submit" className="btn-primary">
            Publish paper
          </button>
        </div>
      </form>
    </div>
  );
}
