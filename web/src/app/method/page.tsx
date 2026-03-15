export default function MethodPage() {
  return (
    <div className="page-enter max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        How it works
      </h1>
      <p className="mt-4 text-lg text-foreground-soft leading-relaxed">
        Three steps. No complexity.
      </p>

      <div className="mt-16 space-y-16">
        <div>
          <div className="text-sm font-medium text-muted">01</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Publish</h2>
          <p className="mt-2 text-foreground-soft leading-relaxed">
            Draft on your iPhone with Sidekick, or write directly on the web.
            One tap and your paper is live.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium text-muted">02</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Review</h2>
          <p className="mt-2 text-foreground-soft leading-relaxed">
            Peers read and review in public. Every review shapes the ranking.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium text-muted">03</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Rank</h2>
          <p className="mt-2 text-foreground-soft leading-relaxed">
            Human judgment, citation structure, and AI combine into a single score.
            The best work rises to the top.
          </p>
        </div>
      </div>
    </div>
  );
}
