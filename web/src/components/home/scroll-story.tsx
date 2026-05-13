"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    num: "01",
    label: "Find",
    body:
      "Search 50+ open scientific datasets from the sidebar. Click to load. No download, no format wrangling. The agent indexes schema and columns automatically.",
  },
  {
    num: "02",
    label: "Analyze",
    body:
      "Write Python, R, or SQL alongside your agent. Cells run locally on your machine. Your data never leaves until you decide to publish.",
  },
  {
    num: "03",
    label: "Interpret",
    body:
      "Your agent reads the analysis as it runs. It catches mistakes, suggests robustness checks, and drafts the methods and results sections in your voice.",
  },
  {
    num: "04",
    label: "Publish",
    body:
      "One click to the live feed. Your paper gets a permanent URL and a citable byline. Readers can replay your full analysis end to end.",
  },
];

export function ScrollStory() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight;
      // progress: 0 when section top hits viewport top, 1 when section bottom leaves viewport bottom.
      const total = rect.height - viewportH;
      if (total <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const idx = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
      setActive(idx);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="border-t border-rule bg-surface">
      <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)] pt-20">
        <div className="max-w-2xl">
          <div className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
            How a paper gets made
          </div>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-normal leading-tight text-ink sm:text-4xl">
            One window, four moves.
          </h2>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)]"
      >
        <div className="grid grid-cols-1 gap-12 py-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-16">
          <div className="relative md:sticky md:top-24 md:self-start">
            <StoryWorkspace active={active} />
          </div>

          <div className="flex flex-col gap-[60vh] md:gap-[80vh]">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className="transition-opacity duration-500"
                style={{ opacity: i === active ? 1 : 0.28 }}
              >
                <div className="font-[family-name:var(--font-mono)] text-[0.75rem] uppercase tracking-[0.18em] text-ink-faint">
                  {step.num} &nbsp; {step.label}
                </div>
                <h3 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-normal leading-tight text-ink sm:text-4xl">
                  {step.body.split(".")[0]}.
                </h3>
                <p className="mt-4 max-w-md text-base leading-relaxed text-ink-light">
                  {step.body.split(".").slice(1).join(".").trim()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StoryWorkspace({ active }: { active: number }) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-[#0F0F0F] text-[0.8125rem] text-[#d4d4d4]"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      <div className="flex items-center gap-2 border-b border-white/5 bg-[#1A1A1A] px-3 py-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="inline-block h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="inline-block h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[0.6875rem] text-white/45" style={{ fontFamily: "var(--font-body)" }}>
          agentscience.app
        </span>
      </div>

      <div className="grid grid-cols-[120px_minmax(0,1fr)] sm:grid-cols-[140px_minmax(0,1fr)]">
        <aside
          className="border-r border-white/5 bg-[#141414] p-3 text-[0.75rem]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <div className="mb-1.5 text-[0.625rem] uppercase tracking-[0.16em] text-white/35">Datasets</div>
          <Row dim={active !== 0} ring={active === 0}>msk-glioma-2019</Row>
          <Row dim={active !== 0}>brca-tcga</Row>
          <Row dim={active !== 0}>openneuro-ds5</Row>
          <div className="mt-3 mb-1.5 text-[0.625rem] uppercase tracking-[0.16em] text-white/35">Papers</div>
          <Row dim={active < 3} ring={active === 3}>paper.md</Row>
        </aside>

        <div className="min-w-0 p-4">
          {active === 0 && <FindFrame />}
          {active === 1 && <AnalyzeFrame />}
          {active === 2 && <InterpretFrame />}
          {active === 3 && <PublishFrame />}
        </div>
      </div>
    </div>
  );
}

function Row({
  children,
  dim,
  ring,
}: {
  children: React.ReactNode;
  dim?: boolean;
  ring?: boolean;
}) {
  return (
    <div
      className={`rounded px-1.5 py-1 ${dim ? "text-white/40" : "text-white"} ${
        ring ? "bg-white/5 ring-1 ring-accent/40" : ""
      }`}
    >
      {children}
    </div>
  );
}

function FindFrame() {
  return (
    <div style={{ fontFamily: "var(--font-body)" }} className="text-[0.8125rem] text-white/70">
      <div className="mb-2 text-[0.625rem] uppercase tracking-[0.16em] text-white/45">Schema · msk-glioma-2019</div>
      <table className="w-full text-[0.75rem]">
        <tbody className="[&_td]:border-b [&_td]:border-white/5 [&_td]:py-1.5">
          <tr><td className="text-white/85">case_id</td><td className="text-white/45">string</td></tr>
          <tr><td className="text-white/85">subtype</td><td className="text-white/45">enum</td></tr>
          <tr><td className="text-white/85">tp53_status</td><td className="text-white/45">categorical</td></tr>
          <tr><td className="text-white/85">egfr_status</td><td className="text-white/45">categorical</td></tr>
          <tr><td className="text-white/85">survival_months</td><td className="text-white/45">float</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function AnalyzeFrame() {
  return (
    <div className="text-[0.8125rem] leading-[1.6]">
      <div><span className="text-[#9d7bd6]">from</span> agentscience <span className="text-[#9d7bd6]">import</span> data</div>
      <div className="opacity-0">&nbsp;</div>
      <div>df = <span className="text-[#7aa8d8]">data</span>.<span className="text-[#d5b65a]">load</span>(<span className="text-[#c98a6b]">&apos;msk-glioma-2019&apos;</span>)</div>
      <div>cases = df[df.subtype == <span className="text-[#c98a6b]">&apos;GSM&apos;</span>]</div>
      <div>
        cases.tp53.<span className="text-[#d5b65a]">value_counts</span>()
        <span className="ml-0.5 inline-block h-[0.85em] w-[5px] translate-y-[1px] bg-accent home-blink align-middle" />
      </div>
    </div>
  );
}

function InterpretFrame() {
  return (
    <div className="flex flex-col gap-3" style={{ fontFamily: "var(--font-body)" }}>
      <div className="flex h-[60px] items-end gap-1.5">
        {[32, 58, 44, 76, 91, 68, 52, 82].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px] bg-accent"
            style={{ height: `${h}%`, opacity: 0.55 + (h / 100) * 0.45 }}
          />
        ))}
      </div>
      <div className="rounded border border-white/10 bg-white/5 p-2.5 text-[0.75rem] text-white/85">
        <div className="mb-1 flex items-center gap-1.5 text-[0.625rem] uppercase tracking-[0.16em] text-white/45">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent home-pulse-dot" />
          research-v2
        </div>
        Found 18 cases with a TP53/RB1-high, EGFR-low pattern. Want me to draft the methods section?
      </div>
    </div>
  );
}

function PublishFrame() {
  return (
    <div style={{ fontFamily: "var(--font-body)" }} className="text-[0.8125rem]">
      <div className="mb-2 text-[0.625rem] uppercase tracking-[0.16em] text-white/45">paper.md · preview</div>
      <div className="rounded border border-white/10 bg-[#0B0B0B] p-3 leading-relaxed text-white/80">
        <div className="mb-1 font-[family-name:var(--font-display)] text-base text-white">
          Gliosarcoma separates from conventional glioblastoma
        </div>
        <div className="text-[0.6875rem] text-white/45">Vineet Reddy · Apr 25, 2026</div>
        <p className="mt-2 text-[0.75rem]">
          Across 18 cases, gliosarcoma showed a TP53/RB1-high, EGFR-low molecular signature
          distinct from conventional glioblastoma…
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-white/75">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent home-pulse-dot" />
        Published to AgentScience &middot; 2.4s ago
      </div>
    </div>
  );
}
