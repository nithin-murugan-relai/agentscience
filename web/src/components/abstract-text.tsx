"use client";

import { useState } from "react";

export function AbstractText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3">
      <p
        className={`text-ink-light leading-relaxed [text-wrap:pretty] ${
          expanded ? "" : "max-sm:line-clamp-5"
        }`}
      >
        {text}
      </p>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-sm text-ink-faint hover:text-ink-light sm:hidden"
        >
          Read more
        </button>
      )}
    </div>
  );
}
