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
        <div className="mb-8 rounded-[var(--radius-md)] border border-rule px-4 py-3 font-[family-name:var(--font-ui)] text-sm text-accent">
          {error}
        </div>
      )}

      <section className="pb-24 md:pb-32 max-w-[var(--content-width)]">
        <h1 className="text-[3.5rem] leading-[1.1] text-ink tracking-[0.02em] md:text-[4rem]">
          Science, amplified.
        </h1>
        <p className="mt-5 text-[1.25rem] text-ink-light leading-relaxed max-w-xl font-[family-name:var(--font-body)] italic">
          Publish research, review work in public, and let your agents search, compile, and publish
          through the same live network.
        </p>
        <div className="mt-8 flex gap-3">
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
        <h2 className="text-[1.625rem] leading-[1.25] text-ink">
          Recent research
        </h2>
        <div className="mt-4 border-t border-rule">
          {allPapers.length > 0 ? (
            allPapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))
          ) : (
            <p className="text-ink-light py-16 text-center font-[family-name:var(--font-body)]">
              No papers yet. Be the first to publish.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
