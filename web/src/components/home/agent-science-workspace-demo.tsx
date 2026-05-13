"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    label: "Literature",
    title: "Start from the papers scientists already trust.",
    body:
      "Paste PMIDs, DOIs, PDFs, or a question. The agent builds a review plan around the source material.",
  },
  {
    label: "Datasets",
    title: "Bring public biological data into the same thread.",
    body:
      "Search the registry, inspect cohorts, and turn open data into figures instead of a detached chat answer.",
  },
  {
    label: "Paper",
    title: "Generate a structured research output.",
    body:
      "The workspace produces papers with figures, citations, synthesized interpretations, and a public record.",
  },
] as const;

const RECENTS = [
  ["ML forecasting strategy for ...", "Awaiting Input", "5d ago"],
  ["find a way to avoid saddle ...", "Awaiting Input", "11d ago"],
  ["write a paper about alzhei...", "Awaiting Input", "14d ago"],
  ["do a paper on trigeminal ne...", "Completed", "18d ago"],
] as const;

const SOURCES = [
  "32842672",
  "10.1038/s41586-023-06887-8",
  "https://pubmed.ncbi.nlm.nih.gov/35414745/",
] as const;

const DATASETS = [
  ["OpenNeuro ds005713", "119 patients", "MRI records"],
  ["CPTAC glioblastoma", "clinical cohort", "genomics"],
  ["MSK glioma 2019", "1,004 samples", "sequencing"],
] as const;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function sceneProgress(progress: number, index: number) {
  return clamp((progress - index / 3) * 3);
}

export function AgentScienceWorkspaceDemo() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const node = sectionRef.current;

      if (!node) {
        return;
      }

      const rect = node.getBoundingClientRect();
      const travel = Math.max(1, rect.height - window.innerHeight);
      setProgress(clamp(-rect.top / travel));
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const activeStep = Math.min(2, Math.floor(progress * 3.01));
  const literatureProgress = sceneProgress(progress, 0);
  const datasetProgress = sceneProgress(progress, 1);
  const paperProgress = sceneProgress(progress, 2);

  return (
    <section ref={sectionRef} className="relative min-h-[265vh]">
      <div className="sticky top-[calc(var(--nav-height)+1.25rem)] mx-auto grid max-w-[var(--page-width)] gap-10 px-[var(--page-gutter)] py-8 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="lg:pt-8">
          <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
            Integrated environment
          </p>
          <h2 className="mt-3 text-2xl font-medium leading-tight text-ink sm:text-3xl">
            The page moves through the same workflow as the app.
          </h2>
          <div className="mt-8 border-t border-rule">
            {STEPS.map((step, index) => (
              <div
                key={step.label}
                className={`border-b border-rule py-5 transition-opacity duration-200 ${
                  activeStep === index ? "opacity-100" : "opacity-45"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activeStep === index ? "bg-accent" : "bg-ink-faint"
                    }`}
                  />
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-faint">
                    {step.label}
                  </p>
                </div>
                <h3 className="mt-3 text-base font-medium leading-snug text-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-light">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-rule bg-snow-white">
          <div className="grid min-h-[620px] lg:grid-cols-[232px_minmax(0,1fr)]">
            <AppSidebar activeStep={activeStep} />
            <div className="min-w-0 bg-surface">
              <div className="flex items-center justify-between border-b border-rule px-5 py-4">
                <p className="text-sm font-medium text-ink">
                  {STEPS[activeStep]?.label ?? "Paper"}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-xs text-ink-faint">
                  {Math.round(progress * 100).toString().padStart(2, "0")}%
                </p>
              </div>
              <div className="relative h-[568px] overflow-hidden">
                <div
                  className="flex h-full w-[300%] transition-transform duration-100 ease-linear"
                  style={{ transform: `translateX(-${progress * 66.6667}%)` }}
                >
                  <LiteratureScene progress={literatureProgress} />
                  <DatasetScene progress={datasetProgress} />
                  <PaperScene progress={paperProgress} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AppSidebar({ activeStep }: { activeStep: number }) {
  const activeNavItem = activeStep === 1 ? "Datasets" : "Papers";

  return (
    <aside className="hidden border-r border-rule bg-snow-white lg:flex lg:flex-col">
      <div className="border-b border-rule px-5 py-5">
        <div className="flex gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="mt-5 flex items-center gap-2 text-ink">
          <Image src="/logo.svg" alt="" width={32} height={32} />
          <span className="font-[family-name:var(--font-display)] text-xl">
            AgentScience
          </span>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div className="rounded-[var(--radius-sm)] bg-ink px-4 py-2.5 text-sm font-medium text-snow-white">
          + New Paper
        </div>
        <div className="rounded-[var(--radius-sm)] border border-rule bg-surface px-4 py-2.5 text-sm font-medium text-ink">
          + New Agent
        </div>
      </div>

      <div className="px-5 py-3">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          Recents
        </p>
        <div className="mt-4 space-y-4">
          {RECENTS.map(([title, status, age]) => (
            <div key={`${title}-${age}`}>
              <p className="truncate text-sm font-medium text-ink">{title}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-light">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === "Completed" ? "bg-[#5ed0a8]" : "bg-accent"
                  }`}
                />
                {status} <span className="text-ink-faint">&middot;</span> {age}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-rule px-5 py-4 text-sm text-ink-light">
        {["Papers", "Datasets", "Settings"].map((item) => (
          <div
            key={item}
            className={`rounded-[var(--radius-sm)] px-3 py-2 ${
              activeNavItem === item
                ? "bg-snow-white-dark font-medium text-ink"
                : ""
            }`}
          >
            {item}
          </div>
        ))}
      </div>
    </aside>
  );
}

function LiteratureScene({ progress }: { progress: number }) {
  return (
    <section className="w-1/3 shrink-0 p-6 sm:p-8">
      <div className="mx-auto max-w-[720px]">
        <p className="flex items-center justify-center gap-2 text-sm font-medium text-ink-light">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Literature review
        </p>
        <h3 className="mt-4 text-center font-[family-name:var(--font-display)] text-4xl font-normal leading-tight text-ink sm:text-5xl">
          Survey what&apos;s known
        </h3>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-relaxed text-ink-light sm:text-base">
          Papers become structured context for an agent, not a pile of tabs.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-[minmax(0,0.9fr)_5rem_minmax(0,1.1fr)] md:items-center">
          <div className="rounded-[var(--radius-md)] border border-rule bg-snow-white px-5 py-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-ink">
                Papers you already have
              </h4>
              <span className="text-xs text-ink-faint">PMIDs / DOIs</span>
            </div>
            <div className="mt-4 space-y-2">
              {SOURCES.map((source, index) => (
                <p
                  key={source}
                  className="font-[family-name:var(--font-mono)] text-sm text-ink-light transition-all duration-300"
                  style={{
                    opacity: clamp(progress * 3 - index * 0.5),
                    transform: `translateY(${(1 - clamp(progress * 3 - index * 0.5)) * 8}px)`,
                  }}
                >
                  {source}
                </p>
              ))}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="relative h-24">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-rule" />
              <span
                className="absolute left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-rule bg-surface text-xs text-ink"
                style={{ top: `${8 + progress * 48}px` }}
              >
                AI
              </span>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-rule bg-surface px-5 py-4">
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
              Review plan
            </p>
            {["Core claims", "Competing hypotheses", "Missing datasets"].map(
              (item, index) => (
                <div key={item} className="mt-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-ink">{item}</p>
                    <p className="text-xs text-ink-faint">
                      [{index + 1 + Math.round(progress * 7)}]
                    </p>
                  </div>
                  <div className="mt-2 h-1 bg-code-bg">
                    <div
                      className="h-full bg-ink"
                      style={{
                        width: `${20 + clamp(progress - index * 0.12) * 72}%`,
                      }}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DatasetScene({ progress }: { progress: number }) {
  const bars = [42, 68, 54, 86, 72, 58];

  return (
    <section className="w-1/3 shrink-0 p-6 sm:p-8">
      <div className="mx-auto max-w-[760px]">
        <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
          Dataset registry
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-4xl font-normal leading-tight text-ink">
              Connect open biological data
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-light">
              The app keeps scientific data visible while the agent interprets
              the question.
            </p>
            <div className="mt-7 border-t border-rule">
              {DATASETS.map(([title, metric, tag], index) => (
                <div
                  key={title}
                  className="border-b border-rule py-4 transition-all duration-300"
                  style={{
                    opacity: clamp(progress * 2.8 - index * 0.45),
                    transform: `translateX(${(1 - clamp(progress * 2.8 - index * 0.45)) * -18}px)`,
                  }}
                >
                  <p className="text-sm font-medium text-ink">{title}</p>
                  <p className="mt-1 text-xs text-ink-light">
                    {metric} <span className="text-ink-faint">&middot;</span> {tag}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-rule bg-snow-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  Generated figure
                </p>
                <p className="text-xs text-ink-faint">
                  clinical metadata + assay results
                </p>
              </div>
              <span className="font-[family-name:var(--font-mono)] text-xs text-ink-faint">
                fig. 2
              </span>
            </div>

            <div className="mt-8 flex h-48 items-end gap-3 border-b border-l border-rule px-4">
              {bars.map((height, index) => (
                <div
                  key={`${height}-${index}`}
                  className="flex-1 bg-ink"
                  style={{
                    height: `${height * clamp(progress * 1.4 - index * 0.06)}%`,
                    opacity: 0.22 + index * 0.08,
                  }}
                />
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {["cohort", "effect", "citation"].map((item, index) => (
                <div
                  key={item}
                  className="border-t border-rule pt-3"
                  style={{
                    opacity: clamp(progress * 2 - index * 0.3),
                  }}
                >
                  <p className="text-[0.625rem] uppercase tracking-[0.16em] text-ink-faint">
                    {item}
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    {index === 0 ? "119" : index === 1 ? "0.42" : "18"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaperScene({ progress }: { progress: number }) {
  return (
    <section className="w-1/3 shrink-0 p-6 sm:p-8">
      <div className="mx-auto grid max-w-[760px] gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="rounded-[var(--radius-md)] border border-rule bg-snow-white p-7">
          <div className="mx-auto max-w-[460px]">
            <h3 className="text-center font-[family-name:var(--font-display)] text-3xl font-normal leading-tight text-ink">
              A Public Release Audit of Trigeminal Neuralgia Metadata
            </h3>
            <p className="mt-4 text-center text-xs text-ink-light">
              Vineet Reddy &middot; University of California, Berkeley
            </p>
            <div className="mt-8">
              <p className="text-center text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-ink">
                Abstract
              </p>
              {[0, 1, 2, 3].map((line) => (
                <div
                  key={line}
                  className="mx-auto mt-2 h-1 bg-code-bg"
                  style={{
                    width: `${line === 3 ? 62 : 92 - line * 8}%`,
                    opacity: clamp(progress * 2.4 - line * 0.32),
                  }}
                />
              ))}
            </div>
            <div className="mt-8 border-t border-rule pt-5">
              <p className="text-sm font-medium text-ink">1 Introduction</p>
              {[0, 1, 2, 3, 4].map((line) => (
                <div
                  key={line}
                  className="mt-2 h-1 bg-code-bg"
                  style={{
                    width: `${line === 4 ? 48 : 100 - line * 6}%`,
                    opacity: clamp(progress * 2 - line * 0.2),
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5">
          <div className="rounded-[var(--radius-md)] border border-rule bg-surface p-5">
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-ink-faint">
              Published record
            </p>
            <div
              className="mt-4 border-t border-rule pt-4 transition-all duration-300"
              style={{
                opacity: clamp(progress * 2),
                transform: `translateY(${(1 - clamp(progress * 2)) * 18}px)`,
              }}
            >
              <p className="font-[family-name:var(--font-display)] text-xl leading-tight text-ink">
                Surgical outcome prediction is not yet reproducible
              </p>
              <p className="mt-2 text-xs text-ink-faint">
                Paper page &middot; dataset manifest synced
              </p>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-rule bg-ink p-5 text-snow-white">
            <p className="text-xs uppercase tracking-[0.18em] text-snow-white/50">
              Open source
            </p>
            <p className="mt-3 text-sm leading-relaxed text-snow-white/85">
              Download the app, inspect the code, and contribute the research
              workflow you need.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
