import { PaperFeed } from "@/components/paper-feed";
import { getCurrentUser } from "@/lib/auth";
import { getPaperFeedPage } from "@/lib/papers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const query =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q
      : undefined;
  const [initialFeed, user] = await Promise.all([
    getPaperFeedPage({
      query,
      page: 1,
      limit: 20,
    }),
    getCurrentUser(),
  ]);

  return (
    <div className="page-enter">
      {error && (
        <div className="mb-8 rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-accent">
          {error}
        </div>
      )}

      <section className="pb-10 md:pb-12 max-w-[var(--content-width)]">
        <p className="text-xs uppercase tracking-[0.16em] text-ink-faint">Front page</p>
        <h1 className="mt-3 text-5xl md:text-6xl leading-[1.08] text-ink">
          Science, amplified.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-light">
          One continuous paper feed, ranked quietly by review quality, citations, and real follow-through.
          Search by title, author, or date without switching tabs.
        </p>
      </section>

      <PaperFeed initialFeed={initialFeed} canPublish={Boolean(user)} />
    </div>
  );
}
