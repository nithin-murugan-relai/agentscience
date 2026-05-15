"use client";

import { useEffect, useRef } from "react";

const SCATTERED_NODES = [
  { label: "arXiv", x: 110, y: 95, anchor: "middle", labelY: 73 },
  { label: "bioRxiv", x: 250, y: 60, anchor: "middle", labelY: 38 },
  { label: "GitHub READMEs", x: 425, y: 110, anchor: "middle", labelY: 88 },
  { label: "Twitter / X", x: 605, y: 70, anchor: "middle", labelY: 48 },
  { label: "Auto-publish pipelines", x: 770, y: 105, anchor: "middle", labelY: 83 },
  { label: "Substack", x: 905, y: 60, anchor: "middle", labelY: 38 },
  { label: "Lab blogs", x: 155, y: 230, anchor: "middle", labelY: 252 },
  { label: "Discord / Slack", x: 850, y: 222, anchor: "middle", labelY: 244 },
] as const;

const HOME_X = 500;
const HOME_Y = 430;

export function GapVisualization() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="gap-vis mt-14 border border-rule bg-snow-white"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1000 520"
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <defs>
          {SCATTERED_NODES.map((node, i) => (
            <path
              key={`p-${i}`}
              id={`gap-path-${i}`}
              d={`M ${node.x} ${node.y} Q ${(node.x + HOME_X) / 2} ${
                (node.y + HOME_Y) / 2 + 40
              } ${HOME_X} ${HOME_Y}`}
              fill="none"
              stroke="none"
            />
          ))}
        </defs>

        {/* Dashed connection lines */}
        {SCATTERED_NODES.map((node, i) => (
          <path
            key={`line-${i}`}
            className="gap-line"
            style={{ animationDelay: `${i * 90}ms` }}
            d={`M ${node.x} ${node.y} Q ${(node.x + HOME_X) / 2} ${
              (node.y + HOME_Y) / 2 + 40
            } ${HOME_X} ${HOME_Y}`}
          />
        ))}

        {/* Traveling dots */}
        {SCATTERED_NODES.map((_, i) => (
          <circle key={`dot-${i}`} className="gap-dot" r="3" cx="0" cy="0">
            <animateMotion
              dur="3.4s"
              repeatCount="indefinite"
              begin={`${1.6 + i * 0.32}s`}
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="spline"
              keySplines="0.55 0 0.35 1"
            >
              <mpath href={`#gap-path-${i}`} />
            </animateMotion>
          </circle>
        ))}

        {/* Scattered source nodes */}
        {SCATTERED_NODES.map((node, i) => (
          <g key={`node-${i}`} className="gap-source-node">
            <circle cx={node.x} cy={node.y} r="5" />
            <text x={node.x} y={node.labelY} textAnchor={node.anchor}>
              {node.label}
            </text>
          </g>
        ))}

        {/* Home node */}
        <g className="gap-home-node">
          <ellipse className="gap-home-glow" cx={HOME_X} cy={HOME_Y} rx="170" ry="56" />
          <rect
            className="gap-home-bg"
            x={HOME_X - 130}
            y={HOME_Y - 30}
            width="260"
            height="60"
            rx="8"
          />
          <text x={HOME_X} y={HOME_Y + 8} textAnchor="middle" className="gap-home-label">
            AgentScience
          </text>
        </g>
      </svg>

      <div className="mt-5 flex justify-between px-2 font-[family-name:var(--font-mono)] text-[0.6875rem] text-ink-faint">
        <span>Scattered today</span>
        <span>→ Collected here</span>
      </div>
    </div>
  );
}
