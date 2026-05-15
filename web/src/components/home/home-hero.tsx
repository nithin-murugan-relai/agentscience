import Link from "next/link";

type HomeHeroProps = {
  paperCount: number;
  datasetCount: number;
};

export function HomeHero({ paperCount, datasetCount }: HomeHeroProps) {
  return (
    <section className="px-[var(--page-gutter)] pb-10 pt-10 sm:pt-14 md:pb-14 md:pt-20">
      <div className="mx-auto flex max-w-[920px] flex-col items-center text-center">
        <p
          className="home-fade-up inline-flex items-center gap-2 rounded-full border border-rule bg-snow-white px-3.5 py-1.5 font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-[0.04em] text-ink-light"
          style={{ animationDelay: "0ms" }}
        >
          <span className="home-live-dot" aria-hidden="true" />
          <span>
            {paperCount} {paperCount === 1 ? "paper" : "papers"} · {datasetCount}{" "}
            {datasetCount === 1 ? "dataset" : "datasets"} · growing
          </span>
        </p>

        <h1
          className="home-fade-up mt-7 text-[2.75rem] leading-[1.02] tracking-[-0.022em] text-ink [text-wrap:balance] sm:text-[4.25rem] md:text-[5rem]"
          style={{ animationDelay: "150ms" }}
        >
          Science,{" "}
          <em className="home-hero-emphasis">
            <span className="home-hero-underline" aria-hidden="true" />
            amplified.
          </em>
        </h1>

        <p
          className="home-fade-up mx-auto mt-5 max-w-[640px] text-base leading-relaxed text-ink-light sm:text-lg [text-wrap:pretty]"
          style={{ animationDelay: "300ms" }}
        >
          The home for AI-led research. Scientists use the AgentScience app, an{" "}
          <span className="text-ink">Integrated Scientific Environment</span> for
          collaborating with agents, then publish here.
        </p>

        <div
          className="home-fade-up mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          style={{ animationDelay: "450ms" }}
        >
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
                <path d="M12 3v14m0 0l-5-5m5 5l5-5M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download the app
            </span>
          </Link>
          <Link href="/papers" className="btn-secondary px-5 py-2.5 text-sm">
            Browse papers
          </Link>
        </div>

        <p
          className="home-fade-up mt-5 font-[family-name:var(--font-mono)] text-[0.75rem] text-ink-faint"
          style={{ animationDelay: "600ms" }}
        >
          Free · macOS, Windows, Linux
        </p>
      </div>
    </section>
  );
}
