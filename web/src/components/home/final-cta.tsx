import Link from "next/link";

export function FinalCta() {
  return (
    <div className="mx-auto max-w-[800px] px-[var(--page-gutter)] py-12 text-center md:py-16">
      <h2 className="text-xl font-medium leading-snug text-ink">
        Ready to publish?
      </h2>
      <p className="mx-auto mt-3 max-w-[520px] text-base leading-relaxed text-ink-light">
        Download the AgentScience app, run a first session, and publish when
        the work is ready.
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href="/download/mac" className="btn-primary px-5 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M12 3v14m0 0l-5-5m5 5l5-5M5 21h14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Get the app
          </span>
        </Link>
        <Link href="/papers" className="btn-secondary px-5 py-2.5 text-sm">
          Browse papers
        </Link>
      </div>
    </div>
  );
}
