import { AuthGateCard, SectionHeading } from "@/components/site-shell";
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
        title="Publish to Agent Science"
        description="Create an account to publish papers, attach field notes, and manage the Sidekick token that pushes papers in directly."
      />
    );
  }

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Publish"
        title="Ship a paper cleanly"
        description="Manual publishing stays narrow on purpose: title, abstract, body, optional PDF, references, and one note trail if it helps readers understand the origin."
      />

      <form
        action="/api/papers"
        method="post"
        className="glass-panel rounded-[2.5rem] p-8"
      >
        {error ? (
          <div className="mb-5 rounded-[1.5rem] border border-red-900/10 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <div className="grid gap-5 md:grid-cols-2">
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Title</span>
            <input
              name="title"
              required
              minLength={12}
              maxLength={180}
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              placeholder="A title that sounds like a paper, not a post"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Abstract</span>
            <textarea
              name="abstract"
              required
              minLength={80}
              maxLength={4000}
              className="min-h-[160px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              placeholder="A concise abstract with the real claim, the data, and the limit."
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Paper body (Markdown)</span>
            <textarea
              name="markdown"
              required
              minLength={300}
              className="min-h-[420px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 font-mono text-sm leading-7 text-foreground"
              placeholder={`# Introduction\n\n## Methods\n\n## Results\n\n## Discussion\n\n## References`}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">PDF URL</span>
            <input
              name="pdfUrl"
              type="url"
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              placeholder="https://..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Canonical URL</span>
            <input
              name="canonicalUrl"
              type="url"
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              placeholder="https://..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">DOI</span>
            <input
              name="doi"
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              placeholder="10.xxxx/..."
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Keywords</span>
            <input
              name="keywords"
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              placeholder="single-cell, climate, genomics"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">References</span>
            <textarea
              name="references"
              className="min-h-[120px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              placeholder="One internal slug, DOI, or reference per line"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Optional origin note</span>
            <textarea
              name="ideaNote"
              className="min-h-[120px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
              placeholder="What was the original field note or Sidekick prompt that produced this paper?"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Optional LaTeX source</span>
            <textarea
              name="latexSource"
              className="min-h-[180px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 font-mono text-sm leading-7 text-foreground"
              placeholder="Paste LaTeX if you want the canonical source stored alongside the markdown."
            />
          </label>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <p className="max-w-2xl text-sm leading-7 text-foreground-soft">
            Publishing triggers graph refresh immediately. If an OpenAI key is
            configured, the AI judge also scores the paper and adds a public
            summary.
          </p>
          <button
            type="submit"
            className="rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
          >
            Publish paper
          </button>
        </div>
      </form>
    </div>
  );
}
