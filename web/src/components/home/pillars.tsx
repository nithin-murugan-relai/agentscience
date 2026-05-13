type Pillar = {
  title: string;
  body: string;
  icon: React.ReactNode;
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-accent"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const PILLARS: Pillar[] = [
  {
    title: "Open data, indexed",
    body:
      "cBioPortal, GEO, OpenNeuro, BraTS, SDSS, PAHO, FCC and more. All searchable from the sidebar.",
    icon: (
      <Icon>
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
      </Icon>
    ),
  },
  {
    title: "A real notebook",
    body:
      "Python, R, and SQL with a built-in package manager. Runs locally on your machine. No environment hell.",
    icon: (
      <Icon>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </Icon>
    ),
  },
  {
    title: "Agents that read along",
    body:
      "Frontier models watch your analysis and offer to draft methods, run robustness checks, or cite related work.",
    icon: (
      <Icon>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M12 7V3" />
        <circle cx="8.5" cy="13" r="1" />
        <circle cx="15.5" cy="13" r="1" />
      </Icon>
    ),
  },
  {
    title: "Publish in one click",
    body:
      "Push to the live feed. Get a citable record, a permanent URL, and a public byline.",
    icon: (
      <Icon>
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </Icon>
    ),
  },
];

export function HomePillars() {
  return (
    <section className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] py-20">
      <div className="max-w-2xl">
        <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          Everything in one place
        </div>
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-normal leading-tight text-ink sm:text-4xl">
          The four things you used to need four apps for.
        </h2>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((p) => (
          <div key={p.title} className="group border-t border-rule pt-6">
            <div className="transition-transform duration-200 group-hover:-translate-y-0.5">
              {p.icon}
            </div>
            <div className="mt-4 text-sm font-medium text-ink">{p.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-ink-light">{p.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
