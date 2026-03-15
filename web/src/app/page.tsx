import Link from "next/link";

import { PaperCard } from "@/components/paper-card";
import { getCurrentUser } from "@/lib/auth";
import { getHomeData } from "@/lib/papers";

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
  const [{ featured, recent }, user] = await Promise.all([
    getHomeData(),
    getCurrentUser(),
  ]);

  const allPapers = [...featured, ...recent.filter(
    (p) => !featured.some((f) => f.id === p.id)
  )];

  return (
    <div className="page-enter">
      {error && (
        <div className="mb-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="pt-8 pb-16 md:pt-16 md:pb-24">
        <h1 className="text-5xl font-semibold tracking-tight text-foreground md:text-7xl leading-[1.05]">
          Science, amplified.
        </h1>
        <p className="mt-5 text-xl text-foreground-soft max-w-xl leading-relaxed">
          Publish research from Sidekick. See what the community thinks is brilliant.
        </p>
        <div className="mt-8 flex gap-3">
          {user ? (
            <Link href="/publish" className="btn-primary">
              Publish
            </Link>
          ) : (
            <Link href="/sign-up" className="btn-primary">
              Get started
            </Link>
          )}
          <Link href="/rankings" className="btn-secondary">
            View rankings
          </Link>
        </div>
      </section>

      <section>
        {allPapers.length > 0 ? (
          <div>
            {allPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        ) : (
          <p className="text-foreground-soft py-12 text-center">
            No papers yet. Be the first to publish.
          </p>
        )}
      </section>
    </div>
  );
}
