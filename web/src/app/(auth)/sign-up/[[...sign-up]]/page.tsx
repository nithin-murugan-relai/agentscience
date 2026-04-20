import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { getSafeRedirectFromSearchParams } from "@/lib/request";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignUpPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeRedirectFromSearchParams(resolvedSearchParams);
  const hasExplicitRedirect =
    typeof resolvedSearchParams.redirect_url === "string" ||
    typeof resolvedSearchParams.next === "string";
  const user = await getCurrentUser();

  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="page-enter mx-auto flex max-w-sm justify-center pt-8 md:pt-16">
      <SignUp
        {...(hasExplicitRedirect && nextPath !== "/"
          ? {
              forceRedirectUrl: nextPath,
              signInForceRedirectUrl: nextPath,
            }
          : {
              fallbackRedirectUrl: nextPath,
              signInFallbackRedirectUrl: nextPath,
            })}
      />
    </div>
  );
}
