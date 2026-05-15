"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppleGlyph } from "@/components/apple-glyph";
import { WindowsGlyph } from "@/components/windows-glyph";

const FEATURES = [
  "Long-running agents that run analyses, fetch data, and reason over results",
  "Full provenance: every claim links back to code, data, and agent transcripts",
  "One-click publish to the AgentScience preprint server",
  "Local-first. Your work stays on your machine until you ship it.",
] as const;

function CheckGlyph() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

export function AppShowcase() {
  return (
    <div className="home-dark-section">
      <div className="mx-auto grid max-w-[var(--page-width)] grid-cols-1 gap-8 px-[var(--page-gutter)] py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12 md:py-14">
        <div>
          <p className="font-[family-name:var(--font-display)] text-base italic text-[color:rgba(245,245,245,0.55)]">
            The Integrated Scientific Environment
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[1.75rem] font-normal leading-[1.1] tracking-[-0.018em] text-[color:var(--surface)] [text-wrap:balance] sm:text-[2.25rem] md:text-[2.5rem]">
            A new kind of workbench for a new kind of{" "}
            <em className="italic">science.</em>
          </h2>
          <p className="mt-4 max-w-[560px] text-[0.9375rem] leading-relaxed text-[color:rgba(245,245,245,0.7)]">
            AgentScience is the desktop app where the science gets done. We
            invented the <span className="text-[color:var(--surface)]">Integrated Scientific Environment</span>
            {" "} (an ISE), so researchers can direct AI agents the way developers
            direct compilers and debuggers in an IDE. We call the work that comes
            out of it <span className="text-[color:var(--surface)]">generative science</span>: research
            authored with AI in the loop, recorded as a first-class record from
            day one.
          </p>

          <ul className="mt-5 space-y-2.5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-[0.9375rem] leading-relaxed text-[color:rgba(245,245,245,0.85)]">
                <span className="home-feature-check" aria-hidden="true">
                  <CheckGlyph />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link href="/download/mac" className="home-download-btn">
              <AppleGlyph className="h-3.5 w-3.5" />
              <span>Apple Silicon</span>
            </Link>
            <Link href="/download/mac/intel" className="home-download-btn">
              <AppleGlyph className="h-3.5 w-3.5" />
              <span>Intel Mac</span>
            </Link>
            <Link href="/download/win" className="home-download-btn">
              <WindowsGlyph className="h-3.5 w-3.5" />
              <span>Windows x64</span>
            </Link>
          </div>
        </div>

        <AppMockup />
      </div>
    </div>
  );
}

function AppMockup() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="home-mockup-wrap" ref={ref}>
      <div className={`home-mockup ${isVisible ? "home-mockup-in" : ""}`} aria-hidden="true">
        <div className="home-mockup-titlebar">
          <span className="home-tl-dot" data-color="r" />
          <span className="home-tl-dot" data-color="y" />
          <span className="home-tl-dot" data-color="g" />
          <span className="home-mockup-title">
            AgentScience · NLGN1 splice-site analysis
          </span>
        </div>
        <div className="home-mockup-body">
          <aside className="home-mockup-sidebar">
            <div className="home-sb-label">Projects</div>
            <SidebarItem label="NLGN1 variants" active />
            <SidebarItem label="BraTS FLAIR" />
            <SidebarItem label="SDSS AGN survey" />
            <SidebarItem label="Pediatric B-ALL" />
            <div className="home-sb-divider" />
            <div className="home-sb-label">Agents</div>
            <SidebarItem label="Data analyst" />
            <SidebarItem label="Lit review" />
            <SidebarItem label="Critic" />
          </aside>
          <div className="home-mockup-main">
            <div className="home-mockup-tab">
              Workspace · session 04
            </div>
            <div className="home-mockup-question">
              Do NLGN1 clinical variants concentrate near splice sites?
            </div>

            <div className="home-mockup-chat">
              <div className={`home-msg home-msg-user ${isVisible ? "home-msg-in" : ""}`} style={{ animationDelay: "200ms" }}>
                Pull all ClinVar NLGN1 submissions and bin by exon proximity.
              </div>
              <div className={`home-msg home-msg-agent ${isVisible ? "home-msg-in" : ""}`} style={{ animationDelay: "600ms" }}>
                <div className="home-agent-tag">
                  <span className="home-agent-dot" />
                  Data analyst
                </div>
                Fetched 247 submissions. 18% within 50bp of splice sites, no
                clear hotspot enrichment vs. background.
              </div>
              <div className={`home-msg home-msg-agent ${isVisible ? "home-msg-in" : ""}`} style={{ animationDelay: "1100ms" }}>
                <div className="home-agent-tag">Critic</div>
                Worth checking pathogenic-only subset before drafting. The full
                set may be diluted by VUS calls.
              </div>
              <div className={`home-typing ${isVisible ? "home-typing-in" : ""}`} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="home-mockup-compose">
              Compose preprint
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="M5 12h14m-5-5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div className={`home-sb-item ${active ? "is-active" : ""}`}>
      <span className="home-sb-dot" />
      <span className="home-sb-text">{label}</span>
    </div>
  );
}
