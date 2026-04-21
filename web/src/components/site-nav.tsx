"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Show, UserButton } from "@clerk/nextjs";

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
          <Link href="/sign-in" className={linkClass("/sign-in")}>
            Sign in
          </Link>
        </Show>

        <Link
          href="/get-started"
          className="inline-flex items-center rounded-[var(--radius-sm)] bg-ink px-3 py-1.5 text-[0.8125rem] font-medium text-snow-white hover:bg-[#333]"
        >
          Download
        </Link>
      </nav>
    </div>
  );
}
