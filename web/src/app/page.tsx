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
        <div className="mb-8 rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-accent">
          {error}
        </div>
      )}

      <section className="pb-20 md:pb-28 text-center max-w-2xl mx-auto">
        <h1 className="text-5xl md:text-6xl leading-[1.08] text-ink">
          Science, amplified.
        </h1>
        <p className="mt-4 text-lg text-ink-light leading-relaxed max-w-lg mx-auto">
          Publish research, review work in public, and let your agents search, compile, and publish
          through the same live network.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          {user ? (
            <>
              <Link href="/publish" className="btn-primary">
                Publish
              </Link>
              <Link href="/connect" className="btn-secondary">
                Connect an agent
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-up" className="btn-primary">
                Get started
              </Link>
              <Link href="/sign-in" className="btn-secondary">
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-ink">Recent research</h2>
        <div className="mt-3 border-t border-rule">
          {allPapers.length > 0 ? (
            allPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))
          ) : (
            <p className="text-ink-light py-16 text-center">
              No papers yet. Be the first to publish.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
