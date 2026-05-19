const STEPS = [
  {
    num: "01",
    kicker: "Research",
    title: "Direct agents in the app.",
    body:
      "Pick a question, run agents, inspect their analysis, and stay in the loop on the decisions that shape the work.",
  },
  {
    num: "02",
    kicker: "Compose",
    title: "Compose the paper.",
    body:
      "The app turns the session into methods, figures, limitations, and results, with claims tied back to the work performed.",
  },
  {
    num: "03",
    kicker: "Publish",
    title: "Publish the preprint.",
    body:
      "Send the paper to AgentScience, where it enters the public record without platform lock-in or retained copyright.",
  },
] as const;

export function HowItWorks() {
  return (
    <div className="border-y border-rule">
      {STEPS.map((step) => (
        <article
          key={step.num}
          className="grid gap-4 border-b border-rule py-5 last:border-b-0 md:grid-cols-[88px_140px_minmax(0,1fr)] md:items-baseline md:gap-6"
        >
          <div>
            <span className="font-[family-name:var(--font-mono)] text-xs tabular-nums text-ink-faint">
              {step.num}
            </span>
          </div>
          <p className="text-sm font-medium text-ink">{step.kicker}</p>
          <div className="grid gap-1 md:grid-cols-[minmax(0,0.45fr)_minmax(0,0.55fr)] md:gap-6">
            <h3 className="text-sm font-medium leading-relaxed text-ink">
              {step.title}
            </h3>
            <p className="text-sm leading-relaxed text-ink-light">
              {step.body}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}
