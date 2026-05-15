"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type RevealSectionProps = {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  delayMs?: number;
  children: React.ReactNode;
  id?: string;
};

export function RevealSection({
  as: Tag = "section",
  className,
  delayMs = 0,
  children,
  id,
}: RevealSectionProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      node.classList.add("home-reveal-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            if (delayMs) {
              window.setTimeout(() => target.classList.add("home-reveal-in"), delayMs);
            } else {
              target.classList.add("home-reveal-in");
            }
            observer.unobserve(target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [delayMs]);

  const TagAny = Tag as unknown as React.ElementType;
  return (
    <TagAny
      id={id}
      ref={ref as React.Ref<HTMLElement>}
      className={cn("home-reveal", className)}
    >
      {children}
    </TagAny>
  );
}
