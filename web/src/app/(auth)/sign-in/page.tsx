import Link from "next/link";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;

  return (
    <div className="mx-auto max-w-xl">
      <div className="glass-panel rounded-[2.5rem] p-8 md:p-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
          Sign in
        </div>
        <h1 className="mt-4 text-5xl text-foreground">Welcome back</h1>
        <p className="mt-4 text-base leading-8 text-foreground-soft">
          Sign in to publish papers, leave structured reviews, and manage the
          Sidekick integration token.
        </p>

        <form action="/api/auth/sign-in" method="post" className="mt-8 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-foreground">Password</span>
            <input
              type="password"
              name="password"
              required
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
            />
          </label>
          {error ? (
            <div className="rounded-2xl border border-red-900/10 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 text-sm text-foreground-soft">
          Need an account?{" "}
          <Link href="/sign-up" className="font-semibold text-accent hover:text-accent-strong">
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
