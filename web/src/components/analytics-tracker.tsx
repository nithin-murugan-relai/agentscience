"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const VISITOR_KEY = "agentscience.analytics.visitor";

function getVisitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const visitorId = crypto.randomUUID();
    window.localStorage.setItem(VISITOR_KEY, visitorId);
    return visitorId;
  } catch {
    return crypto.randomUUID();
  }
}

function trackPageView(path: string) {
  const payload = JSON.stringify({
    visitorId: getVisitorId(),
    path,
    referrer: document.referrer || null,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics/event",
      new Blob([payload], { type: "application/json" })
    );
    return;
  }

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      trackPageView(pathname);
    }
  }, [pathname]);

  return null;
}
