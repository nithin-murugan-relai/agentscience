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
    <div className="page-enter mx-auto max-w-md pt-8 md:pt-16">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground text-center">
        Create account
      </h1>

      <form action="/api/auth/sign-up" method="post" className="mt-8 space-y-4">
        <input type="hidden" name="next" value={nextPath} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Name</span>
            <input name="name" required autoComplete="name" className="field-input text-sm" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Handle</span>
            <input name="handle" required autoComplete="username" spellCheck={false} className="field-input text-sm" placeholder="jane-doe" />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input type="email" name="email" required autoComplete="email" className="field-input text-sm" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Institution</span>
          <input name="institution" autoComplete="organization" className="field-input text-sm" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Bio</span>
          <textarea name="bio" maxLength={220} className="field-textarea min-h-[80px] text-sm leading-relaxed" placeholder="Optional" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">Password</span>
          <input type="password" name="password" required minLength={10} autoComplete="new-password" className="field-input text-sm" />
        </label>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={buildPathWithNext("/sign-in", nextPath)}
          className="text-accent hover:text-accent-hover font-medium"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
