import Link from "next/link";

import { AppleGlyph } from "@/components/apple-glyph";

export function MacDownloadLinks() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/download/mac"
          className="inline-flex min-w-56 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-ink px-6 py-3 text-sm font-medium text-snow-white hover:bg-[#333]"
        >
          <AppleGlyph className="h-4 w-4" />
          <span>Apple Silicon Mac</span>
        </Link>
        <Link
          href="/download/mac/intel"
          className="inline-flex min-w-56 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-rule px-6 py-3 text-sm font-medium text-ink hover:border-ink hover:bg-snow-white"
        >
          <AppleGlyph className="h-4 w-4" />
          <span>Intel Mac</span>
        </Link>
      </div>
      <p className="text-xs text-ink-faint">Requires macOS 13 or later</p>
    </div>
  );
}
