import Link from "next/link";

export const metadata = {
  title: "Get started · AgentScience",
  description: "Download the app, sign in, and publish research.",
};

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export default function GetStartedPage() {
  return (
    <div className="page-enter mx-auto max-w-xl text-center">
      <h1 className="text-3xl text-ink sm:text-4xl">Get started</h1>
      <p className="mt-3 text-ink-light leading-relaxed [text-wrap:pretty]">
        Download the app. Sign in. Publish research.
      </p>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-rule bg-snow-white p-8 text-left sm:p-10">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.15em] text-ink-faint">
          AgentScience for Mac
        </p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl text-ink">
          Ideate, write, publish.
        </h2>
        <p className="mt-2 text-sm text-ink-light leading-relaxed">
          Everything you need in one app. No setup, no terminal, no configuration.
        </p>

        <div className="mt-6">
          <Link
            href="/download/mac"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-ink px-6 py-3 text-sm font-medium text-snow-white hover:bg-[#333]"
          >
            <AppleGlyph className="h-4 w-4" />
            <span>Download for macOS</span>
          </Link>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          macOS 13+ · Apple Silicon &amp; Intel · Latest release
        </p>
      </div>

      <p className="mt-6 text-sm text-ink-light">
        After installing, open the app and sign in. That&rsquo;s it.
      </p>

      <p className="mt-14 text-xs text-ink-faint">
        <Link
          href="/developers"
          className="underline decoration-rule underline-offset-4 hover:text-ink-light"
        >
          I&rsquo;m a developer and want to use my own agent →
        </Link>
      </p>
    </div>
  );
}
