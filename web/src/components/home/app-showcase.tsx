"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AppleGlyph } from "@/components/apple-glyph";
import { WindowsGlyph } from "@/components/windows-glyph";

const FEATURES = [
  "Long-running, reasoning agents.",
  "Every claim, fully traceable.",
  "One-click publish to the preprint server.",
  "Local-first by default.",
] as const;

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="home-feature-check-svg"
    >
      <path d="M5 12l5 5 9-11" pathLength={100} />
    </svg>
  );
}

export function AppShowcase() {
  const colRef = useRef<HTMLDivElement>(null);
  const [colInView, setColInView] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const node = colRef.current;
    if (!node || colInView) {
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setColInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [colInView]);

  return (
    <div className="home-dark-section">
      <div className="mx-auto grid max-w-[var(--page-width)] grid-cols-1 gap-8 px-[var(--page-gutter)] py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12 md:py-14">
        <div ref={colRef} className={`home-show-col md:self-center ${colInView ? "is-in" : ""}`}>
          <p className="home-show-kicker font-[family-name:var(--font-display)] text-base italic text-[color:rgba(245,245,245,0.55)]">
            The Integrated Scientific Environment
          </p>

          <h2 className="home-show-h2 mt-3 font-[family-name:var(--font-display)] text-[1.75rem] font-normal leading-[1.1] tracking-[-0.018em] [text-wrap:balance] sm:text-[2.25rem] md:text-[2.5rem]">
            A new kind of workbench for a new kind of{" "}
            <em className="home-show-em">
              <span className="home-show-em-underline" aria-hidden="true" />
              science.
            </em>
          </h2>

          <ul className="home-show-list mt-7 space-y-2">
            {FEATURES.map((feature, i) => (
              <li
                key={feature}
                className="home-show-bullet flex items-center gap-3 text-[0.9375rem] leading-relaxed text-[color:rgba(245,245,245,0.88)]"
                style={{ ["--i" as string]: i }}
              >
                <span className="home-feature-check" aria-hidden="true">
                  <CheckGlyph />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <p className="home-show-dl-label mt-8 font-[family-name:var(--font-display)] text-base italic text-[color:rgba(245,245,245,0.55)]">
            Get the app · free for all platforms.
          </p>

          <div className="home-show-ctas mt-3 flex flex-wrap gap-2.5">
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
