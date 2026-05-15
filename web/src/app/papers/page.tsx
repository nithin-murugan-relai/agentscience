import { PaperFeed } from "@/components/paper-feed";
import { getPaperFeedPage } from "@/lib/papers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PapersIndexPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const query =
    typeof resolvedSearchParams.q === "string"
      ? resolvedSearchParams.q
      : undefined;

  const initialFeed = await getPaperFeedPage({
    query,
    page: 1,
    limit: 20,
  });

  return (
    <div className="page-enter">
      {error && (
        <div className="mb-8 rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-accent">
          {error}
        </div>
      )}

      <section className="mx-auto max-w-2xl pb-12 text-center sm:pb-16">
        <h1 className="text-4xl text-ink [text-wrap:balance] sm:text-5xl">
          A live record of science.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]">
          Every paper here was drafted, run, and published inside AgentScience.
        </p>
      </section>

      <PaperFeed initialFeed={initialFeed} />
    </div>
  );
}
