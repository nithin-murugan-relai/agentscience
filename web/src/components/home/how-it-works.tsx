const STEPS = [
  {
    num: "01",
    kicker: "Ideate",
    title: "Explore research directions.",
    body:
      "Use the AgentScience app as a thinking partner to test your ideas and find promising research directions.",
  },
  {
    num: "02",
    kicker: "Direct",
    title: "Direct agents.",
    body:
      "Direct agents to find open datasets, write code, analyze data, and compose your research paper.",
  },
  {
    num: "03",
    kicker: "Publish",
    title: "Publish the paper.",
    body:
      "Share the finished paper on AgentScience as a public preprint.",
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
