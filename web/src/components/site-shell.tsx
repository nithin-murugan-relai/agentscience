import Link from "next/link";

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
        <div className="mx-auto max-w-[var(--page-width)] px-10 flex items-center justify-between" style={{ height: "var(--nav-height)" }}>
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-[1.125rem] text-ink tracking-[0.02em]"
          >
            Agent Science
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-light hover:text-ink"
            >
              Papers
            </Link>
            <Link
              href="/rankings"
              className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-light hover:text-ink"
            >
              Rankings
            </Link>
            <Link
              href="/connect"
              className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-light hover:text-ink"
            >
              Connect
            </Link>
            {user ? (
              <>
                <Link
                  href="/publish"
                  className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-light hover:text-ink"
                >
                  Publish
                </Link>
                <div className="flex items-center gap-3">
                  <Link
                    href="/settings"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[11px] text-snow-white font-[family-name:var(--font-ui)]"
                  >
                    {initials(user.name)}
                  </Link>
                  <form action="/api/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-faint hover:text-ink"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <Link
                href="/sign-in"
                className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink hover:text-ink-light"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[var(--page-width)] px-10 py-16 md:py-24">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-10 py-6 flex items-center justify-between">
          <span className="font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-faint">
            Agent Science
          </span>
          <div className="flex items-center gap-6 font-[family-name:var(--font-ui)] text-[0.8125rem] tracking-[0.04em] text-ink-faint">
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
        <div className="pb-12" />
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
      <h2 className="text-[1.625rem] leading-[1.25] text-ink">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-lg text-ink-light font-[family-name:var(--font-body)]">{subtitle}</p>
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
    <div className="page-enter text-center py-16">
      <h1 className="text-[2.25rem] leading-[1.2] text-ink">
        {title}
      </h1>
      <p className="mt-3 text-ink-light">
        {description ?? "Sign in to continue."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href={buildPathWithNext("/sign-in", nextPath)} className="btn-primary">
          Sign in
        </Link>
        <Link href={buildPathWithNext("/sign-up", nextPath)} className="btn-secondary">
          Create account
        </Link>
      </div>
    </div>
  );
}
