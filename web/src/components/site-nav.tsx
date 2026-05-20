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

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PapersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v5h5" />
      <path d="M10 12h6" />
      <path d="M10 16h6" />
    </svg>
  );
}

export function SiteNav() {
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
          Home
        </Link>
        <Link href="/papers" className={linkClass("/papers")}>
          Papers
        </Link>
        <Link href="/datasets" className={linkClass("/datasets")}>
          Datasets
        </Link>

        <Show when="signed-in">
          <UserButton
            userProfileMode="navigation"
            userProfileUrl="/account"
            appearance={{
              elements: {
                userButtonAvatarBox: "h-7 w-7",
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Link label="Your papers" labelIcon={<PapersIcon />} href="/papers/me" />
              <UserButton.Link
                label="Settings"
                labelIcon={<SettingsIcon />}
                href="/settings"
              />
              <UserButton.Action label="manageAccount" />
              <UserButton.Action label="signOut" />
            </UserButton.MenuItems>
          </UserButton>
        </Show>
        <Show when="signed-out">
          <Link href="/sign-in" className={linkClass("/sign-in")}>
            Sign in
          </Link>
        </Show>

        <Link
          href="/get-started"
          className="hidden sm:inline-flex items-center rounded-[var(--radius-sm)] bg-ink px-3 py-1.5 text-[0.8125rem] font-medium text-snow-white hover:bg-[#333]"
        >
          Get started
        </Link>
      </nav>
    </div>
  );
}
