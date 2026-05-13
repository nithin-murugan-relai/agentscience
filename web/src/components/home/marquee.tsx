const ITEMS = [
  "Open datasets",
  "Python + R + SQL",
  "Frontier agents",
  "Version control",
  "Live peer review",
  "Citable bylines",
  "Reproducible by default",
];

export function HomeMarquee() {
  const row = (
    <div className="flex shrink-0 items-center gap-10 px-5">
      {ITEMS.map((item) => (
        <span
          key={item}
          className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint"
        >
          {item}
          <span className="ml-10 inline-block text-rule">/</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="overflow-hidden border-y border-rule bg-snow-white py-3">
      <div className="home-marquee-track flex">
        {row}
        {row}
      </div>
    </div>
  );
}
