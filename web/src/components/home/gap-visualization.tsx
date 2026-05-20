"use client";

import { useEffect, useRef } from "react";

/**
 * Animated creation pipeline showing:
 *   Left:   Research ideas (polished pill shapes)
 *   Center: AgentScience App with agents working INSIDE
 *   Right:  Paper published on AgentScience preprint server
 */

export function GapVisualization() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      node.classList.add("in-view");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="cvis mt-10" aria-hidden="true">
      <svg viewBox="0 0 820 260" preserveAspectRatio="xMidYMid meet" className="cvis-svg">
        <defs>
          <marker
            id="cvis-arrowhead"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9" className="cvis-arrowhead" />
          </marker>
          {/* Flow paths: ideas -> app */}
          <path id="fp0" d="M 120,55 C 170,55 190,90 230,95" />
          <path id="fp1" d="M 120,100 C 170,100 190,105 230,108" />
          <path id="fp2" d="M 120,145 C 170,145 190,120 230,118" />
          {/* Flow path: app -> preprint */}
          <path id="fp3" d="M 535,108 H 602" />
        </defs>

        {/* ════════ LEFT: Research ideas ════════ */}
        <g className="cvis-ideas">
          {/* Idea pill 1 */}
          <g className="cvis-idea" style={{ animationDelay: "0ms" }}>
            <rect x="20" y="40" width="90" height="28" rx="14" className="cvis-pill" />
            <line x1="36" y1="50" x2="78" y2="50" className="cvis-pill-line" />
            <line x1="36" y1="58" x2="65" y2="58" className="cvis-pill-line cvis-pill-line-short" />
          </g>
          {/* Idea pill 2 */}
          <g className="cvis-idea" style={{ animationDelay: "120ms" }}>
            <rect x="10" y="85" width="100" height="28" rx="14" className="cvis-pill" />
            <line x1="26" y1="95" x2="82" y2="95" className="cvis-pill-line" />
            <line x1="26" y1="103" x2="68" y2="103" className="cvis-pill-line cvis-pill-line-short" />
          </g>
          {/* Idea pill 3 */}
          <g className="cvis-idea" style={{ animationDelay: "240ms" }}>
            <rect x="25" y="130" width="85" height="28" rx="14" className="cvis-pill" />
            <line x1="41" y1="140" x2="80" y2="140" className="cvis-pill-line" />
            <line x1="41" y1="148" x2="72" y2="148" className="cvis-pill-line cvis-pill-line-short" />
          </g>
          {/* Accent dots */}
          <circle cx="125" cy="48" r="2" className="cvis-accent-dot" style={{ animationDelay: "0.3s" }} />
          <circle cx="118" cy="130" r="1.5" className="cvis-accent-dot" style={{ animationDelay: "0.6s" }} />
          <circle cx="8" cy="120" r="1.5" className="cvis-accent-dot" style={{ animationDelay: "0.9s" }} />
        </g>

        <text x="62" y="185" textAnchor="middle" className="cvis-label">
          Your ideas
        </text>

        {/* ════════ Arrows: ideas → app ════════ */}
        <g className="cvis-arrow cvis-arrow-1">
          <path d="M 128,55 C 168,55 190,89 219,95" markerEnd="url(#cvis-arrowhead)" />
          <path d="M 128,100 C 168,100 190,105 219,108" markerEnd="url(#cvis-arrowhead)" />
          <path d="M 128,145 C 168,145 190,121 219,118" markerEnd="url(#cvis-arrowhead)" />
        </g>

        {/* ════════ CENTER: AgentScience ISE ════════ */}
        <g className="cvis-ise">
          {/* Window frame */}
          <rect x="225" y="22" width="300" height="175" rx="8" className="cvis-frame" />

          {/* Title bar */}
          <rect x="225" y="22" width="300" height="26" rx="8" className="cvis-titlebar" />
          <rect x="225" y="40" width="300" height="8" className="cvis-titlebar" />
          {/* Traffic lights */}
          <circle cx="241" cy="35" r="4" fill="#ABABAB" opacity="0.45" />
          <circle cx="254" cy="35" r="4" fill="#ABABAB" opacity="0.35" />
          <circle cx="267" cy="35" r="4" fill="#ABABAB" opacity="0.45" />
          <text x="375" y="39" textAnchor="middle" className="cvis-win-title">
            AgentScience App
          </text>

          {/* ── Agent connection lines ──
              Endpoints stop at each agent's bg-circle edge (plus a 1.5px
              gap) so the dashed link never crosses through the agent text.
              Centers: Analyst (320,82) r=22 · Writer (290,145) r=22 ·
              Reviewer (405,140) r=22. */}
          <g className="cvis-links">
            <line x1="310" y1="103" x2="300" y2="124" />
            <line x1="314" y1="144" x2="382" y2="141" />
            <line x1="386" y1="127" x2="339" y2="95" />
          </g>

          {/* ── Agent: Analyst ── */}
          <g className="cvis-agent cvis-agent-1">
            <circle cx="320" cy="82" r="30" className="cvis-agent-glow" />
            <circle cx="320" cy="82" r="22" className="cvis-agent-bg" />
            <text x="320" y="85" textAnchor="middle" className="cvis-agent-name">
              Analyst
            </text>
          </g>

          {/* ── Agent: Writer ── */}
          <g className="cvis-agent cvis-agent-2">
            <circle cx="290" cy="145" r="30" className="cvis-agent-glow" />
            <circle cx="290" cy="145" r="22" className="cvis-agent-bg" />
            <text x="290" y="148" textAnchor="middle" className="cvis-agent-name">
              Writer
            </text>
          </g>

          {/* ── Agent: Reviewer ── */}
          <g className="cvis-agent cvis-agent-3">
            <circle cx="405" cy="140" r="30" className="cvis-agent-glow" />
            <circle cx="405" cy="140" r="22" className="cvis-agent-bg" />
            <text x="405" y="143" textAnchor="middle" className="cvis-agent-name">
              Reviewer
            </text>
          </g>

          {/* Activity indicator */}
          <g className="cvis-activity">
            <circle cx="462" cy="67" r="4" className="cvis-activity-dot" />
            <text x="470" y="70" className="cvis-activity-label">Working</text>
          </g>
        </g>

        {/* Flowing dots: ideas → App (rendered AFTER ISE so they appear on top) */}
        {[0, 1, 2].map((i) => (
          <circle key={`fd-${i}`} className="cvis-flow-dot" r="2.5">
            <animateMotion
              dur={`${2.2 + i * 0.3}s`}
              repeatCount="indefinite"
              begin={`${1.8 + i * 0.5}s`}
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="spline"
              keySplines="0.4 0 0.2 1"
            >
              <mpath href={`#fp${i}`} />
            </animateMotion>
          </circle>
        ))}

        <text x="375" y="220" textAnchor="middle" className="cvis-label cvis-label-bold">
          Direct agents in the AgentScience App
        </text>

        {/* ════════ Arrow: app → preprint ════════ */}
        <g className="cvis-arrow cvis-arrow-2">
          <path d="M 535,108 H 602" markerEnd="url(#cvis-arrowhead)" />
        </g>

        {/* Compose dots: ISE → paper */}
        {[0, 1].map((i) => (
          <circle key={`cd-${i}`} className="cvis-compose-dot" r="3">
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              begin={`${2.5 + i * 0.8}s`}
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="spline"
              keySplines="0.3 0 0.2 1"
            >
              <mpath href="#fp3" />
            </animateMotion>
          </circle>
        ))}

        {/* ════════ RIGHT: Published paper ════════ */}
        <g className="cvis-paper">
          {/* Shadow */}
          <rect x="613" y="30" width="135" height="160" rx="5" className="cvis-paper-shadow" />
          {/* Page */}
          <rect x="610" y="27" width="135" height="160" rx="5" className="cvis-paper-bg" />

          {/* Title line */}
          <rect x="626" y="42" width="85" height="5" rx="2" className="cvis-tline cvis-tline-title" style={{ animationDelay: "2.0s" }} />
          {/* Author line */}
          <rect x="626" y="54" width="55" height="3" rx="1.5" className="cvis-tline" style={{ animationDelay: "2.15s" }} />
          {/* Body lines */}
          <rect x="626" y="68" width="100" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "2.3s" }} />
          <rect x="626" y="76" width="90" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "2.45s" }} />
          <rect x="626" y="84" width="95" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "2.6s" }} />
          <rect x="626" y="92" width="75" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "2.75s" }} />
          {/* Section header */}
          <rect x="626" y="106" width="65" height="4" rx="1.5" className="cvis-tline cvis-tline-heading" style={{ animationDelay: "2.9s" }} />
          {/* More body */}
          <rect x="626" y="118" width="100" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "3.05s" }} />
          <rect x="626" y="126" width="88" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "3.2s" }} />
          <rect x="626" y="134" width="95" height="2.5" rx="1" className="cvis-tline" style={{ animationDelay: "3.35s" }} />

          {/* Published badge */}
          <g className="cvis-badge">
            <rect x="632" y="152" width="100" height="24" rx="5" className="cvis-badge-bg" />
            <text x="682" y="168" textAnchor="middle" className="cvis-badge-text">
              Published
            </text>
          </g>
        </g>

        <text x="677" y="210" textAnchor="middle" className="cvis-label">
          Preprint on AgentScience
        </text>
      </svg>
    </div>
  );
}
