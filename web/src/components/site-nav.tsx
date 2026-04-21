"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";

function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="280 218 460 520" className={className} aria-hidden="true">
      <g transform="translate(512, 488)">
        <path
          d="M-72,-260 L-72,-100 L-205,190 Q-215,222 -180,238 L180,238 Q215,222 205,190 L72,-100 L72,-260"
          fill="none"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line
          x1="-102"
          y1="-260"
          x2="102"
          y2="-260"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <line x1="-50" y1="60" x2="40" y2="145" stroke="#3b5bdb" strokeWidth="6" opacity="0.30" />
        <line x1="40" y1="145" x2="90" y2="78" stroke="#3b5bdb" strokeWidth="6" opacity="0.30" />
        <line x1="-50" y1="60" x2="-108" y2="145" stroke="#3b5bdb" strokeWidth="6" opacity="0.30" />
        <line x1="-108" y1="145" x2="40" y2="145" stroke="#3b5bdb" strokeWidth="5" opacity="0.22" />
        <circle cx="-50" cy="60" r="20" fill="#3b5bdb" opacity="0.85" />
        <circle cx="40" cy="145" r="23" fill="#3b5bdb" opacity="0.92" />
        <circle cx="90" cy="78" r="16" fill="#3b5bdb" opacity="0.70" />
        <circle cx="-108" cy="145" r="18" fill="#3b5bdb" opacity="0.75" />
        <circle cx="-24" cy="195" r="14" fill="#3b5bdb" opacity="0.60" />
        <circle cx="18" cy="20" r="13" fill="#3b5bdb" opacity="0.55" />
      </g>
    </svg>
  );
}

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

type SiteNavUser = {
  name: string;
  initials: string;
} | null;

export function SiteNav({ user }: { user: SiteNavUser }) {
  const pathname = usePathname() ?? "/";

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const linkClass = (href: string) =>
    isActive(href)
      ? "text-[0.8125rem] font-medium text-ink"
      : "text-[0.8125rem] text-ink-light hover:text-ink";

  return (
    <div
      className="mx-auto flex max-w-[var(--page-width)] items-center justify-between gap-4 px-[var(--page-gutter)]"
      style={{ height: "var(--nav-height)" }}
    >
      <Link href="/" className="flex items-center gap-1.5 text-ink">
        <LogoMark className="h-7 w-7" />
        <span className="font-[family-name:var(--font-display)] text-lg">AgentScience</span>
      </Link>

      <nav className="flex items-center gap-4 sm:gap-5">
        <Link href="/" className={linkClass("/")}>
          Papers
        </Link>
        <Link href="/datasets" className={linkClass("/datasets")}>
          Datasets
        </Link>

        <Show when="signed-in">
          {user ? (
            <div className="flex items-center gap-2.5">
              <Link
                href="/settings"
                aria-label="Settings"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-snow-white"
              >
                {user.initials}
              </Link>
              <UserButton userProfileMode="navigation" userProfileUrl="/account" />
            </div>
          ) : null}
        </Show>
        <Show when="signed-out">
          <SignInButton>
            <button type="button" className="text-[0.8125rem] text-ink-light hover:text-ink">
              Sign in
            </button>
          </SignInButton>
        </Show>

        <Link
          href="/download/mac"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-ink px-3 py-1.5 text-[0.8125rem] font-medium text-snow-white hover:bg-[#333]"
        >
          <AppleGlyph className="h-3.5 w-3.5" />
          <span>Download</span>
        </Link>
      </nav>
    </div>
  );
}
