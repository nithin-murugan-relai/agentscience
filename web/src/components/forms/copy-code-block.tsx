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
          className="text-xs text-ink-light hover:text-ink mb-1"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-rule bg-code-bg px-4 py-3 font-[family-name:var(--font-mono)] text-[13px] leading-6 text-ink whitespace-pre-wrap break-all sm:text-sm sm:whitespace-pre sm:break-normal">
        <code>{code}</code>
      </pre>
    </div>
  );
}
