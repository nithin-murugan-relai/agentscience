import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { buildPathWithNext, getSafeRedirectFromSearchParams } from "@/lib/request";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const nextPath = getSafeRedirectFromSearchParams(resolvedSearchParams);
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="page-enter mx-auto max-w-sm pt-8 md:pt-16">
      <h1 className="text-3xl text-ink text-center">Create account</h1>

      <form action="/api/auth/sign-up" method="post" className="mt-8 space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="grid gap-4 grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm text-ink">Name</span>
            <input name="name" required autoComplete="name" className="field-input" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-ink">Handle</span>
            <input name="handle" required autoComplete="username" spellCheck={false} className="field-input" placeholder="jane-doe" />
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm text-ink">Email</span>
          <input type="email" name="email" required autoComplete="email" className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink">Password</span>
          <input type="password" name="password" required minLength={10} autoComplete="new-password" className="field-input" />
        </label>
        <input type="hidden" name="institution" value="" />
        <input type="hidden" name="bio" value="" />
        {error && (
          <div className="rounded-[var(--radius-md)] border border-rule px-4 py-3 text-sm text-accent">
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-faint">
        Already have an account?{" "}
        <Link
          href={buildPathWithNext("/sign-in", nextPath)}
          className="text-ink hover:text-accent"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
