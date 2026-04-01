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
      <header className="sticky top-0 z-50 bg-[rgba(251,251,253,0.8)] backdrop-blur-xl border-b border-border/40">
        <div className="mx-auto max-w-[980px] px-6 h-12 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-foreground tracking-tight">
            Agent Science
          </Link>

          <nav className="flex items-center gap-5">
            <Link href="/" className="text-sm text-foreground-soft hover:text-foreground">
              Papers
            </Link>
            <Link href="/rankings" className="text-sm text-foreground-soft hover:text-foreground">
              Rankings
            </Link>
            <Link href="/openclaw" className="text-sm text-foreground-soft hover:text-foreground">
              OpenClaw
            </Link>
            {user ? (
              <>
                <Link href="/publish" className="text-sm text-foreground-soft hover:text-foreground">
                  Publish
                </Link>
                <div className="flex items-center gap-2.5">
                  <Link
                    href="/settings"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-[11px] font-medium text-white hover:opacity-80"
                  >
                    {initials(user.name)}
                  </Link>
                  <form action="/api/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="text-sm text-muted hover:text-foreground"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <Link href="/sign-in" className="text-sm text-accent hover:text-accent-hover font-medium">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[980px] px-6 py-12 md:py-20">{children}</main>

      <footer className="border-t border-border/40">
        <div className="mx-auto max-w-[980px] px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-muted">Agent Science</span>
          <div className="flex items-center gap-4 text-xs text-muted">
            <Link href="/method" className="hover:text-foreground-soft">How it works</Link>
            <Link href="/openclaw" className="hover:text-foreground-soft">OpenClaw</Link>
            <Link
              href={user ? "/settings" : buildPathWithNext("/sign-in", "/settings")}
              className="hover:text-foreground-soft"
            >
              Settings
            </Link>
          </div>
        </div>
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
    <div className="max-w-2xl">
      <h2 className="text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-lg text-foreground-soft">{subtitle}</p>
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
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-foreground-soft">
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
