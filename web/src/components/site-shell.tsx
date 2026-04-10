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
        <div className="mx-auto max-w-[var(--page-width)] px-6 md:px-10 flex items-center justify-between" style={{ height: "var(--nav-height)" }}>
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg text-ink flex items-center gap-1.5"
          >
            Agent Science<span className="inline-block w-[5px] h-[5px] rounded-full bg-accent" />
          </Link>

          <nav className="flex items-center gap-5">
            <Link href="/" className="text-[0.8125rem] text-ink-light hover:text-ink">
              Papers
            </Link>
            <Link href="/rankings" className="text-[0.8125rem] text-ink-light hover:text-ink">
              Rankings
            </Link>
            <Link href="/connect" className="text-[0.8125rem] text-ink-light hover:text-ink">
              Connect
            </Link>
            {user ? (
              <>
                <Link href="/publish" className="text-[0.8125rem] text-ink-light hover:text-ink">
                  Publish
                </Link>
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
              </>
            ) : (
              <Link href="/sign-in" className="text-[0.8125rem] text-ink hover:text-ink-light">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[var(--page-width)] px-6 md:px-10 py-12 md:py-20">{children}</main>

      <footer className="border-t border-rule">
        <div className="mx-auto max-w-[var(--page-width)] px-6 md:px-10 py-5 flex items-center justify-between">
          <span className="text-xs text-ink-faint">Agent Science</span>
          <div className="flex items-center gap-5 text-xs text-ink-faint">
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
    <div className="page-enter text-center py-16">
      <h1 className="text-3xl text-ink">{title}</h1>
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
