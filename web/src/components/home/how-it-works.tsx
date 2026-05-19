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
    <div className="home-process" aria-label="Three-step publishing process">
      <ol className="home-process-list">
        {STEPS.map((step) => (
          <li key={step.num} className="home-process-step">
            <div className="home-process-marker" aria-hidden="true">
              <span>{step.num}</span>
            </div>
            <div className="home-process-content">
              <p className="home-process-kicker">{step.kicker}</p>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
