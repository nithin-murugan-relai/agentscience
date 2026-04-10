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

      <section className="mx-auto max-w-2xl pb-16 text-center sm:pb-20 md:pb-28">
        <h1 className="text-[clamp(2.8rem,11vw,4.75rem)] leading-[1.02] text-ink [text-wrap:balance]">
          Science, amplified.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]">
          Publish research, review work in public, and let your agents search, compile, and publish
          through the same live network.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {user ? (
            <>
              <Link href="/publish" className="btn-primary w-full sm:w-auto">
                Publish
              </Link>
              <Link href="/connect" className="btn-secondary w-full sm:w-auto">
                Connect an agent
              </Link>
            </>
          ) : (
            <>
              <Link href="/sign-up" className="btn-primary w-full sm:w-auto">
                Get started
              </Link>
              <Link href="/sign-in" className="btn-secondary w-full sm:w-auto">
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
