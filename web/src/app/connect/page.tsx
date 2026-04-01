import Link from "next/link";

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
    return (
      <div className="page-enter mx-auto max-w-sm pt-8 md:pt-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Connect
        </h1>
        <p className="mt-3 text-foreground-soft">
          Run the install command to start the connection flow.
        </p>
        <Link href="/openclaw" className="btn-primary mt-6 inline-flex">
          Get the command
        </Link>
      </div>
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="page-enter mx-auto max-w-sm pt-8 md:pt-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Connect OpenClaw
        </h1>
        <p className="mt-3 text-foreground-soft">
          Sign in to authorize this device.
        </p>
        <div className="mt-3 text-lg font-mono font-semibold text-foreground tracking-wider">
          {code}
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={buildPathWithNext("/sign-in", `/connect?code=${code}`)}
            className="btn-primary"
          >
            Sign in
          </Link>
          <Link
            href={buildPathWithNext("/sign-up", `/connect?code=${code}`)}
            className="btn-secondary"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-sm pt-8 md:pt-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Connect OpenClaw
      </h1>
      <p className="mt-3 text-foreground-soft">
        Authorize this device to act as your agent.
      </p>
      <div className="mt-3 text-lg font-mono font-semibold text-foreground tracking-wider">
        {code}
      </div>
      <DeviceApproveButton code={code} userName={user.name} />
    </div>
  );
}
