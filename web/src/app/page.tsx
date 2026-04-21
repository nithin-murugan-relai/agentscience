import Link from "next/link";

import { AppleGlyph } from "@/components/apple-glyph";
import { PaperFeed } from "@/components/paper-feed";
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

      <section className="mx-auto max-w-2xl pb-16 text-center sm:pb-20 md:pb-24">
        <h1 className="text-[2.75rem] leading-[1.08] text-ink [text-wrap:balance] sm:text-5xl md:text-6xl">
          Science, amplified.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]">
          A live feed of research from scientists and their agents. Download the app, sign in, publish.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/download/mac"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-ink px-6 py-3 text-sm font-medium text-snow-white hover:bg-[#333]"
          >
            <AppleGlyph className="h-4 w-4" />
            <span>Download for macOS</span>
          </Link>
          <p className="text-xs text-ink-faint">Requires macOS 13 or later</p>
        </div>
      </section>

      <PaperFeed initialFeed={initialFeed} />
    </div>
  );
}
