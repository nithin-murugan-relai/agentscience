import Link from "next/link";

import { PaperFeed } from "@/components/paper-feed";
import { getPaperFeedPage } from "@/lib/papers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

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
            <span>Download for Mac</span>
          </Link>
          <p className="text-xs text-ink-faint">
            macOS 13+ · Free while in beta ·{" "}
            <Link
              href="/sign-in"
              className="text-ink-light underline decoration-rule underline-offset-4 hover:text-ink"
            >
              Already have the app? Sign in
            </Link>
          </p>
        </div>
      </section>

      <PaperFeed initialFeed={initialFeed} />
    </div>
  );
}
