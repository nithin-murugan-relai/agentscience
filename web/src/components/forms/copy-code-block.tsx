"use client";

import { useState } from "react";

export function CopyCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="text-sm font-medium text-accent hover:text-accent-hover mb-1"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl border border-border bg-[#f6f7fb] px-4 py-3 text-sm leading-6 text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
