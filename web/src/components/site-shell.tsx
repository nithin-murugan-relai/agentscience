import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/auth";
import { buildPathWithNext } from "@/lib/request";
import { initials } from "@/lib/utils";

export async function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="relative min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-snow-white/90 backdrop-blur-sm border-b border-rule">
        <SiteNav user={user ? { name: user.name, initials: initials(user.name) } : null} />
      </header>

      <main className="flex-1 mx-auto w-full max-w-[var(--page-width)] px-[var(--page-gutter)] py-12 md:py-20">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[var(--page-width)] flex-col gap-3 px-[var(--page-gutter)] py-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-ink-faint">AgentScience</span>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-faint">
            <Link href="/method" className="hover:text-ink-light">How it works</Link>
            <Link href="/datasets" className="hover:text-ink-light">Datasets</Link>
            <Link href="/get-started" className="hover:text-ink-light">Download</Link>
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
