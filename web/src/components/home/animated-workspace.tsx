"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero IDE-style workspace mockup that animates through:
 *   load dataset → write code → run analysis → agent suggestion → publish toast
 *
 * Designed to look like the real AgentScience desktop app
 * (left sidebar with Papers / Datasets / Agents, editor + agent panel
 * on the right, publish toast at the bottom).
 *
 * Animation is driven by a single phase counter (0..9) advanced on a
 * setTimeout schedule. Re-runs when the section scrolls into view and
 * via a small Replay button.
 */

type Phase = number;

const SCHEDULE_MS = [
  0,    // 0 frame mounted
  400,  // 1 line 1 visible
  900,  // 2 line 2 (blank)
  1600, // 3 line 3 (data.load)
  2400, // 4 line 4 + sidebar pulse
  3200, // 5 line 5 (plot.bar)
  4000, // 6 chart bars grow
  5500, // 7 agent message typed
  7000, // 8 agent actions appear
  8500, // 9 publish toast
] as const;

const CODE_LINES: Array<Array<{ text: string; cls?: string }>> = [
  [
    { text: "from", cls: "text-[#9d7bd6]" },
    { text: " agentscience " },
    { text: "import", cls: "text-[#9d7bd6]" },
    { text: " data, agent" },
  ],
  [{ text: "" }],
  [
    { text: "df " },
    { text: "= ", cls: "text-[#b388eb]" },
    { text: "data", cls: "text-[#7aa8d8]" },
    { text: "." },
    { text: "load", cls: "text-[#d5b65a]" },
    { text: "(" },
    { text: "'msk-glioma-2019'", cls: "text-[#c98a6b]" },
    { text: ")" },
  ],
  [
    { text: "cases " },
    { text: "= ", cls: "text-[#b388eb]" },
    { text: "df" },
    { text: "[" },
    { text: "df", cls: "text-[#7aa8d8]" },
    { text: "." },
    { text: "subtype " },
    { text: "== ", cls: "text-[#b388eb]" },
    { text: "'GSM'", cls: "text-[#c98a6b]" },
    { text: "]" },
  ],
  [
    { text: "cases", cls: "text-[#7aa8d8]" },
    { text: "." },
    { text: "tp53" },
    { text: "." },
    { text: "value_counts", cls: "text-[#d5b65a]" },
    { text: "()." },
    { text: "plot", cls: "text-[#7aa8d8]" },
    { text: "." },
    { text: "bar", cls: "text-[#d5b65a]" },
    { text: "()" },
  ],
];

const BAR_HEIGHTS = [32, 58, 44, 76, 91, 68, 52, 82, 38, 64];

const AGENT_MESSAGE =
  "Found 18 gliosarcoma cases with a TP53/RB1-high, EGFR-low pattern. " +
  "This separates them from conventional glioblastoma. " +
  "Want me to draft the methods section?";

function useTimeline(active: boolean) {
  const [phase, setPhase] = useState<Phase>(0);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;
    SCHEDULE_MS.forEach((ms, i) => {
      const id = window.setTimeout(() => setPhase(i), ms);
      timeouts.current.push(id);
    });
    return () => {
      timeouts.current.forEach((id) => window.clearTimeout(id));
      timeouts.current = [];
    };
  }, [active]);

  return phase;
}

function useTypewriter(text: string, active: boolean, durationMs = 1400) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) return;
    let i = 0;
    const stepMs = Math.max(8, Math.floor(durationMs / text.length));
    const id = window.setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) window.clearInterval(id);
    }, stepMs);
    return () => window.clearInterval(id);
  }, [text, active, durationMs]);
  return out;
}

export function AnimatedWorkspace() {
  const [runId, setRunId] = useState(0);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting && !inView) {
          setInView(true);
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  const active = inView;
  // Use runId as a reset key so children remount on replay.
  return (
    <div ref={containerRef} className="relative">
      <WorkspaceFrame key={runId} active={active} />
      <button
        type="button"
        onClick={() => setRunId((n) => n + 1)}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-white/10 bg-white/5 px-2 py-1 text-[0.6875rem] font-medium text-white/70 backdrop-blur-sm hover:bg-white/10 hover:text-white"
        aria-label="Replay workspace demo"
      >
        <ReplayIcon /> Replay
      </button>
    </div>
  );
}

function WorkspaceFrame({ active }: { active: boolean }) {
  const phase = useTimeline(active);
  const agentTyped = useTypewriter(AGENT_MESSAGE, phase >= 7);

  return (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-[#0F0F0F] text-[#d4d4d4]"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      <TitleBar />
      <div className="grid grid-cols-[160px_minmax(0,1fr)] md:grid-cols-[180px_minmax(0,1fr)_260px]">
        <Sidebar phase={phase} />
        <MainPane phase={phase} />
        <AgentPanel phase={phase} message={agentTyped} done={phase >= 7 && agentTyped.length === AGENT_MESSAGE.length} />
      </div>
      <PublishToast visible={phase >= 9} />
    </div>
  );
}

function TitleBar() {
  return (
    <div className="flex items-center gap-2 border-b border-white/5 bg-[#1A1A1A] px-3 py-2">
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
      <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      <span className="ml-3 text-[0.6875rem] text-white/45" style={{ fontFamily: "var(--font-body)" }}>
        agentscience.app
      </span>
      <span className="ml-auto flex items-center gap-1.5 text-[0.6875rem] text-white/40" style={{ fontFamily: "var(--font-body)" }}>
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent home-pulse-dot" />
        connected to <span className="text-white/70">msk-glioma-2019</span>
      </span>
    </div>
  );
}

function Sidebar({ phase }: { phase: number }) {
  const datasetHighlighted = phase >= 4;
  return (
    <aside
      className="hidden border-r border-white/5 bg-[#141414] p-3 text-[0.75rem] md:block"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <SidebarSection label="Datasets">
        <SidebarRow active={datasetHighlighted} highlight={datasetHighlighted}>
          msk-glioma-2019
        </SidebarRow>
        <SidebarRow>brca-tcga</SidebarRow>
        <SidebarRow>openneuro-ds5</SidebarRow>
      </SidebarSection>
      <SidebarSection label="Papers">
        <SidebarRow>draft.md</SidebarRow>
      </SidebarSection>
      <SidebarSection label="Agents">
        <SidebarRow>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent home-pulse-dot align-middle" />
          research-v2
        </SidebarRow>
      </SidebarSection>
    </aside>
  );
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-[0.625rem] uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SidebarRow({
  children,
  active,
  highlight,
}: {
  children: React.ReactNode;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded px-1.5 py-1 transition-colors ${
        active ? "bg-white/5 text-white" : "text-white/55"
      } ${highlight ? "ring-1 ring-accent/40" : ""}`}
    >
      {children}
    </div>
  );
}

function MainPane({ phase }: { phase: number }) {
  const visibleLines = Math.min(CODE_LINES.length, Math.max(0, phase));
  const cursorOnLine = visibleLines === CODE_LINES.length && phase < 6;

  return (
    <div className="min-w-0">
      <Tabs />
      <Editor visibleLines={visibleLines} cursorOnLastLine={cursorOnLine} />
      <Output phase={phase} />
    </div>
  );
}

function Tabs() {
  return (
    <div
      className="flex items-center gap-0 border-b border-white/5 bg-[#141414] text-[0.75rem]"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <Tab active>analysis.py</Tab>
      <Tab>
        paper.md
        <span className="ml-1 inline-block h-1 w-1 rounded-full bg-accent align-middle" />
      </Tab>
    </div>
  );
}

function Tab({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      className={`border-r border-white/5 px-3 py-2 ${
        active ? "bg-[#0F0F0F] text-white" : "text-white/55"
      }`}
    >
      {children}
    </div>
  );
}

function Editor({
  visibleLines,
  cursorOnLastLine,
}: {
  visibleLines: number;
  cursorOnLastLine: boolean;
}) {
  return (
    <div className="px-4 py-3 text-[0.8125rem] leading-[1.55]">
      {CODE_LINES.map((tokens, idx) => {
        const isVisible = idx < visibleLines;
        const isLast = idx === visibleLines - 1;
        return (
          <div key={idx} className="flex min-h-[1.4em] gap-3">
            <span className="w-4 select-none text-right text-white/25">{idx + 1}</span>
            <span className={isVisible ? "home-fade-up" : "opacity-0"}>
              {tokens.map((t, i) => (
                <span key={i} className={t.cls}>
                  {t.text}
                </span>
              ))}
              {isVisible && isLast && cursorOnLastLine ? (
                <span className="ml-0.5 inline-block h-[0.95em] w-[6px] translate-y-[2px] bg-accent home-blink align-middle" />
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Output({ phase }: { phase: number }) {
  if (phase < 6) {
    return <div className="border-t border-white/5 px-4 py-4 text-[0.75rem] text-white/35" style={{ fontFamily: "var(--font-body)" }}>
      &rarr; output
    </div>;
  }
  return (
    <div className="border-t border-white/5 px-4 py-4">
      <div className="mb-2 flex items-center gap-2 text-[0.6875rem] uppercase tracking-[0.16em] text-white/45" style={{ fontFamily: "var(--font-body)" }}>
        <span>output</span>
        <span className="text-white/20">·</span>
        <span className="text-white/70">18 cases matched</span>
      </div>
      <div className="flex h-[72px] items-end gap-1.5">
        {BAR_HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="home-bar flex-1 rounded-[2px] bg-accent"
            style={{
              height: `${h}%`,
              animationDelay: `${i * 70}ms`,
              opacity: 0.55 + (h / 100) * 0.45,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AgentPanel({
  phase,
  message,
  done,
}: {
  phase: number;
  message: string;
  done: boolean;
}) {
  return (
    <aside
      className="hidden flex-col gap-3 border-l border-white/5 bg-[#0E0E0E] p-4 text-[0.75rem] md:flex"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <div className="flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.16em] text-white/45">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent home-pulse-dot" />
        research-v2 · analyzing
      </div>

      <div className="min-h-[7rem] text-[0.8125rem] leading-relaxed text-white/85">
        {phase >= 7 ? (
          <>
            {message}
            {!done ? (
              <span className="ml-0.5 inline-block h-[0.85em] w-[5px] translate-y-[1px] bg-accent home-blink align-middle" />
            ) : null}
          </>
        ) : (
          <span className="text-white/35">Reading along…</span>
        )}
      </div>

      {phase >= 8 ? (
        <div className="home-fade-up flex flex-col gap-2">
          <button className="rounded border border-white/15 bg-white/5 px-2.5 py-1.5 text-left text-[0.75rem] text-white/85 hover:bg-white/10">
            Draft methods section
          </button>
          <button className="rounded border border-white/10 px-2.5 py-1.5 text-left text-[0.75rem] text-white/65 hover:bg-white/5">
            Run robustness check
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function PublishToast({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="home-toast flex items-center gap-2 border-t border-white/5 bg-[#0B0B0B] px-4 py-2.5 text-[0.75rem] text-white/80"
      style={{ fontFamily: "var(--font-body)" }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent home-pulse-dot" />
      <span className="text-white">Paper published to AgentScience</span>
      <span className="text-white/25">·</span>
      <span className="text-white/70">Gliosarcoma separates from conventional glioblastoma</span>
      <span className="ml-auto text-white/40">live</span>
    </div>
  );
}

function ReplayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}
