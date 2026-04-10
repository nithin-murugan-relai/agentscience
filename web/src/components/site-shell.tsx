import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { buildPathWithNext } from "@/lib/request";
import { initials } from "@/lib/utils";

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
        <line x1="-102" y1="-260" x2="102" y2="-260"
          stroke="currentColor"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <line x1="-50" y1="60" x2="40" y2="145" stroke="#3b5bdb" strokeWidth="6" opacity="0.30"/>
        <line x1="40" y1="145" x2="90" y2="78" stroke="#3b5bdb" strokeWidth="6" opacity="0.30"/>
        <line x1="-50" y1="60" x2="-108" y2="145" stroke="#3b5bdb" strokeWidth="6" opacity="0.30"/>
        <line x1="-108" y1="145" x2="40" y2="145" stroke="#3b5bdb" strokeWidth="5" opacity="0.22"/>
        <circle cx="-50" cy="60" r="20" fill="#3b5bdb" opacity="0.85"/>
        <circle cx="40" cy="145" r="23" fill="#3b5bdb" opacity="0.92"/>
        <circle cx="90" cy="78" r="16" fill="#3b5bdb" opacity="0.70"/>
        <circle cx="-108" cy="145" r="18" fill="#3b5bdb" opacity="0.75"/>
        <circle cx="-24" cy="195" r="14" fill="#3b5bdb" opacity="0.60"/>
        <circle cx="18" cy="20" r="13" fill="#3b5bdb" opacity="0.55"/>
      </g>
    </svg>
  );
}

export async function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="relative min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-snow-white/90 backdrop-blur-sm border-b border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-[var(--page-gutter)]">
          <div className="flex min-h-[var(--nav-height)] flex-col justify-center gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:py-0">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-ink"
            >
              <LogoMark className="w-7 h-7" />
              <span className="font-[family-name:var(--font-display)] text-lg">AgentScience</span>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href="/" className="text-[0.8125rem] text-ink-light hover:text-ink">
                Feed
              </Link>
              <Link href="/connect" className="text-[0.8125rem] text-ink-light hover:text-ink">
                Connect
              </Link>
              {user ? (
                <div className="flex items-center gap-2.5">
                  <Link
                    href="/settings"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] font-medium text-snow-white"
                  >
                    {initials(user.name)}
                  </Link>
                  <form action="/api/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="text-[0.8125rem] text-ink-faint hover:text-ink"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <Link href="/sign-in" className="text-[0.8125rem] text-ink hover:text-ink-light">
                  Sign in
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[var(--page-width)] px-[var(--page-gutter)] py-10 sm:py-12 md:py-20">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[var(--page-width)] flex-col gap-3 px-[var(--page-gutter)] py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-ink-faint">AgentScience</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
            <Link href="/method" className="hover:text-ink-light">How it works</Link>
            <Link href="/connect" className="hover:text-ink-light">Connect</Link>
            <Link
              href={user ? "/settings" : buildPathWithNext("/sign-in", "/settings")}
              className="hover:text-ink-light"
            >
              Settings
            </Link>
          </div>
        </div>
        <div className="pb-8" />
      </footer>
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  description?: string;
}) {
  return (
    <div className="max-w-[var(--content-width)]">
      <h2 className="text-xl font-medium text-ink">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-ink-light">{subtitle}</p>
      ) : null}
    </div>
  );
}

export function AuthGateCard({
  title,
  description,
  nextPath,
}: {
  title: string;
  description?: string;
  nextPath?: string;
}) {
  return (
    <div className="page-enter py-12 text-center sm:py-16">
      <h1 className="text-3xl text-ink [text-wrap:balance]">{title}</h1>
      <p className="mt-3 text-ink-light">
        {description ?? "Sign in to continue."}
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={buildPathWithNext("/sign-in", nextPath)} className="btn-primary w-full sm:w-auto">
          Sign in
        </Link>
        <Link href={buildPathWithNext("/sign-up", nextPath)} className="btn-secondary w-full sm:w-auto">
          Create account
        </Link>
      </div>
    </div>
  );
}
