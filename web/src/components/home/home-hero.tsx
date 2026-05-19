import Link from "next/link";

export function HomeHero() {
  return (
    <section className="px-[var(--page-gutter)] pb-10 pt-10 sm:pt-14 md:pb-14 md:pt-20">
      <div className="mx-auto flex max-w-[920px] flex-col items-center text-center">
        <h1
          className="home-fade-up text-[3rem] leading-[1.02] text-ink [text-wrap:balance] sm:text-[3.5rem] md:text-[3.75rem]"
          style={{ animationDelay: "0ms" }}
        >
          Science,{" "}
          <em className="home-hero-emphasis">
            amplified.
          </em>
        </h1>

        <p
          className="home-fade-up mx-auto mt-5 max-w-[640px] text-base leading-relaxed text-ink-light [text-wrap:balance] sm:text-lg"
          style={{ animationDelay: "180ms" }}
        >
          You bring the idea. Agents run the research, compose the paper, and
          publish the preprint to AgentScience.
        </p>

        <div
          className="home-fade-up mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          style={{ animationDelay: "330ms" }}
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
          style={{ animationDelay: "480ms" }}
        >
          Free ·{" "}
          <a
            href="https://github.com/vineet-reddy/agentscience"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-ink-faint underline-offset-2 hover:text-ink"
          >
            Open source
          </a>{" "}
          · macOS, Windows, Linux
        </p>
      </div>
    </section>
  );
}
