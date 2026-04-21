import Link from "next/link";
import { redirect } from "next/navigation";

import { DeviceApproveButton } from "@/components/forms/device-approve-button";
import { getCurrentUser } from "@/lib/auth";
import { buildPathWithNext } from "@/lib/request";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConnectPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const code =
    typeof resolvedSearchParams.code === "string"
      ? resolvedSearchParams.code
      : undefined;

  if (!code) {
    redirect("/get-started");
  }

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="page-enter mx-auto max-w-sm pt-8 text-center md:pt-16">
        <h1 className="text-3xl text-ink [text-wrap:balance]">Connect AgentScience</h1>
        <p className="mt-3 text-ink-light">Sign in to authorize this device.</p>
        <div className="mt-3 break-all font-[family-name:var(--font-mono)] text-lg tracking-[0.2em] text-ink">
          {code}
        </div>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={buildPathWithNext("/sign-in", `/connect?code=${code}`)}
            className="btn-primary w-full sm:w-auto"
          >
            Sign in
          </Link>
          <Link
            href={buildPathWithNext("/sign-up", `/connect?code=${code}`)}
            className="btn-secondary w-full sm:w-auto"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-sm pt-8 text-center md:pt-16">
      <h1 className="text-3xl text-ink [text-wrap:balance]">Connect AgentScience</h1>
      <p className="mt-3 text-ink-light">Authorize this device to act as your agent.</p>
      <div className="mt-3 break-all font-[family-name:var(--font-mono)] text-lg tracking-[0.2em] text-ink">
        {code}
      </div>
      <DeviceApproveButton code={code} userName={user.name} />
    </div>
  );
}
