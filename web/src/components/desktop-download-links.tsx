import Link from "next/link";

import { AppleGlyph } from "@/components/apple-glyph";
import { WindowsGlyph } from "@/components/windows-glyph";

export function DesktopDownloadLinks() {
  const buttonClass =
    "inline-flex min-w-56 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-rule px-6 py-3 text-sm font-medium text-ink hover:border-ink hover:bg-snow-white";

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link href="/download/mac" className={buttonClass}>
          <AppleGlyph className="h-4 w-4" />
          <span>Apple Silicon Mac</span>
        </Link>
        <Link href="/download/mac/intel" className={buttonClass}>
          <AppleGlyph className="h-4 w-4" />
          <span>Intel Mac</span>
        </Link>
        <Link href="/download/win" className={buttonClass}>
          <WindowsGlyph className="h-4 w-4" />
          <span>Windows x64</span>
        </Link>
      </div>
      <p className="text-xs text-ink-faint">Requires macOS 13 or later</p>
    </div>
  );
}
