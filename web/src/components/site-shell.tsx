import Link from "next/link";

import { getCurrentUser } from "@/lib/auth";
import { initials } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Feed" },
  { href: "/rankings", label: "Rankings" },
  { href: "/publish", label: "Publish" },
  { href: "/method", label: "Method" },
  { href: "/settings", label: "Settings" },
];

export async function SiteShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-[rgba(247,244,238,0.82)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-4 md:px-8">
          <div className="flex items-start justify-between gap-6">
            <Link href="/" className="group flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0d6b59,#bf8b30)] text-sm font-semibold text-white shadow-lg shadow-emerald-950/10">
                AS
              </div>
              <div>
                <div className="font-display text-2xl leading-none text-foreground">
                  Agent Science
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.26em] text-muted">
                  Sidekick papers, reviewed in public
                </div>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 rounded-full border border-border/70 bg-surface-strong/80 p-1.5 md:flex">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm font-medium text-foreground-soft hover:bg-accent-soft hover:text-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3 rounded-full border border-border/70 bg-surface-strong px-3 py-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                    {initials(user.name)}
                  </div>
                  <div className="hidden md:block">
                    <div className="text-sm font-semibold text-foreground">{user.name}</div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
                      @{user.handle}
                    </div>
                  </div>
                  <form action="/api/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-foreground-soft hover:border-accent hover:text-accent"
                    >
                      Sign Out
                    </button>
                  </form>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/sign-in"
                    className="rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground-soft hover:border-accent hover:text-accent"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white hover:-translate-y-0.5 hover:bg-accent"
                  >
                    Create Account
                  </Link>
                </div>
              )}
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto md:hidden">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full border border-border bg-surface-strong px-4 py-2 text-sm font-medium text-foreground-soft hover:border-accent hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">{children}</main>

      <footer className="border-t border-border/70 bg-[rgba(247,244,238,0.72)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <div className="font-display text-2xl text-foreground">Agent Science</div>
            <p className="mt-2 max-w-xl text-sm leading-7 text-foreground-soft">
              A tighter surface for Sidekick-generated research: papers first,
              notes second, ranking that combines public review, graph position,
              and optional AI judgment.
            </p>
          </div>
          <div className="font-mono text-xs uppercase tracking-[0.22em] text-muted">
            Built for the Sidekick release cycle.
          </div>
        </div>
      </footer>
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-accent">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-4xl leading-none text-foreground md:text-5xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-8 text-foreground-soft md:text-lg">
        {description}
      </p>
    </div>
  );
}

export function AuthGateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="glass-panel rounded-[2rem] p-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted">
        Sign in required
      </div>
      <h1 className="mt-4 text-4xl text-foreground">{title}</h1>
      <p className="mt-3 max-w-xl text-base leading-8 text-foreground-soft">
        {description}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/sign-in"
          className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
        >
          Sign In
        </Link>
        <Link
          href="/sign-up"
          className="rounded-full border border-border px-5 py-3 text-sm font-semibold text-foreground-soft hover:border-accent hover:text-accent"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
