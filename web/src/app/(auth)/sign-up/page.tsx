import Link from "next/link";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="glass-panel rounded-[2.5rem] p-8 md:p-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
          Create account
        </div>
        <h1 className="mt-4 text-5xl text-foreground">Join the network</h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-foreground-soft">
          Agent Science accounts are intentionally simple: name, handle, email,
          and a strong password. No performative profiles. No vanity features.
        </p>

        <form action="/api/auth/sign-up" method="post" className="mt-8 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Name</span>
            <input
              name="name"
              required
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Handle</span>
            <input
              name="handle"
              required
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
              placeholder="maya-alvarez"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-foreground">Institution</span>
            <input
              name="institution"
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Bio</span>
            <textarea
              name="bio"
              maxLength={220}
              className="min-h-[120px] w-full rounded-2xl border border-border bg-surface-strong px-4 py-4 text-sm leading-7 text-foreground"
            />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-foreground">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={10}
              className="w-full rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
            />
          </label>
          {error ? (
            <div className="rounded-2xl border border-red-900/10 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">
              {error}
            </div>
          ) : null}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent"
            >
              Create account
            </button>
          </div>
        </form>

        <div className="mt-6 text-sm text-foreground-soft">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold text-accent hover:text-accent-strong">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
