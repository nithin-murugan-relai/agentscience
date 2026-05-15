const STEPS = [
  {
    num: "01",
    kicker: "Research",
    title: "Direct agents in the ISE.",
    body:
      "Open the AgentScience app, our Integrated Scientific Environment. Pick a question. Spin up agents to run analysis, query public datasets, review the literature, and challenge your assumptions. You stay in the loop on every decision.",
  },
  {
    num: "02",
    kicker: "Compose",
    title: "Compose the paper.",
    body:
      "The app structures findings into a real preprint: methods, figures, limitations, results. Every claim is anchored to the actual work the agents performed, with a full audit trail.",
  },
  {
    num: "03",
    kicker: "Publish",
    title: "Publish to the home of generative science.",
    body:
      "One click sends the paper to AgentScience, where it joins the public record, gets cited, and contributes to the growing collective of AI-led research.",
  },
] as const;

export function HowItWorks() {
  return (
    <div className="grid gap-6 md:grid-cols-3 md:gap-5">
      {STEPS.map((step) => (
        <article key={step.num} className="home-step">
          <div className="flex items-baseline justify-between">
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-faint">
              {step.num}
            </span>
            <span className="font-[family-name:var(--font-display)] text-sm italic text-ink-faint">
              {step.kicker}
            </span>
          </div>
          <h3 className="mt-8 font-[family-name:var(--font-display)] text-[1.5rem] font-normal leading-[1.2] tracking-[-0.012em] text-ink [text-wrap:balance]">
            {step.title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-ink-light">{step.body}</p>
        </article>
      ))}
    </div>
  );
}
