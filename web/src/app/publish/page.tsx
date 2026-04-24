import { AuthGateCard } from "@/components/site-shell";
import { getCurrentUser } from "@/lib/auth";
import { PublishForm } from "./publish-form";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublishPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const error =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : undefined;
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthGateCard
        title="Sign in to publish"
        description="Create an account or sign in to publish a paper."
        nextPath="/publish"
      />
    );
  }

  return (
    <div className="page-enter mx-auto max-w-[var(--content-width)]">
      <h1 className="text-3xl text-ink">Publish</h1>

      <PublishForm initialError={error} />
    </div>
  );
}
