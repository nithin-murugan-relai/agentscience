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

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.73.5.67 5.57.67 11.85c0 5.02 3.24 9.27 7.74 10.78.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.15.69-3.81-1.52-3.81-1.52-.52-1.31-1.27-1.66-1.27-1.66-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.51-.29-5.16-1.26-5.16-5.6 0-1.24.44-2.25 1.16-3.04-.12-.29-.51-1.45.11-3.02 0 0 .96-.31 3.15 1.16.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.18-1.47 3.14-1.16 3.14-1.16.62 1.57.23 2.73.11 3.02.72.79 1.16 1.8 1.16 3.04 0 4.35-2.66 5.31-5.19 5.59.41.36.77 1.05.77 2.12 0 1.53-.01 2.77-.01 3.14 0 .31.21.66.79.55 4.5-1.51 7.73-5.76 7.73-10.78C23.33 5.57 18.27.5 12 .5z" />
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
        <Link href="/papers" className={linkClass("/papers")}>
          Papers
        </Link>
        <Link href="/datasets" className={linkClass("/datasets")}>
          Datasets
        </Link>
        <Link href="/method" className={linkClass("/method")}>
          How it works
        </Link>

        <a
          href="https://github.com/vineet-reddy/agentscience"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="AgentScience on GitHub"
          title="View on GitHub"
          className="text-ink-light hover:text-ink"
        >
          <GitHubIcon className="h-[18px] w-[18px]" />
        </a>

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
