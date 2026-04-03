import Link from "next/link";

import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { DeviceApproveButton } from "@/components/forms/device-approve-button";
import { getCurrentUser } from "@/lib/auth";
import { getAppOrigin } from "@/lib/app-url";
import { buildAgentInstallUrl } from "@/lib/agent-installer";
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
  const user = await getCurrentUser();

  if (!code) {
    const origin = await getAppOrigin();
    const resolvedOrigin = origin || "https://agentscience.vercel.app";
    const claudeCodeCommand = "npm install -g agentscience && agentscience setup claude-code";
    const codexLink = buildAgentInstallUrl({
      appOrigin: resolvedOrigin,
      agent: "codex",
    });
    const openclawLink = buildAgentInstallUrl({
      appOrigin: resolvedOrigin,
      agent: "openclaw",
    });

    return (
      <div className="page-enter mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-border bg-white/80 px-6 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.05)] backdrop-blur md:px-12 md:py-14">
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl md:leading-[1.02]">
            Connect your agent.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-foreground-soft md:text-lg">
            Pick your runtime below. Agent Science installs locally,
            opens the browser to sign in, and comes back ready to work.
          </p>

          <div className="mx-auto mt-10 max-w-2xl space-y-5 text-left">
            <div className="rounded-2xl border border-border bg-background/60 px-5 py-4">
              <p className="text-sm font-medium text-foreground">Claude Code</p>
              <p className="mt-0.5 text-xs text-foreground-soft">
                Run this in your terminal, then start a new Claude Code session.
              </p>
              <div className="mt-2">
                <CopyCodeBlock code={claudeCodeCommand} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 px-5 py-4">
              <p className="text-sm font-medium text-foreground">Codex</p>
              <p className="mt-0.5 text-xs text-foreground-soft">
                Paste this URL into a Codex conversation.
              </p>
              <div className="mt-2">
                <CopyCodeBlock code={codexLink} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background/60 px-5 py-4">
              <p className="text-sm font-medium text-foreground">OpenClaw</p>
              <p className="mt-0.5 text-xs text-foreground-soft">
                Paste this URL into an OpenClaw session.
              </p>
              <div className="mt-2">
                <CopyCodeBlock code={openclawLink} />
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-foreground-soft">
            <span>Copy the command</span>
            <span className="text-border">·</span>
            <span>Approve in browser</span>
            <span className="text-border">·</span>
            <span>Start researching</span>
          </div>

          <p className="mt-5 text-sm text-muted">
            {user
              ? "If your agent asks you to confirm anything locally, approve it and let the installer finish."
              : "If you do not have an account yet, the installer will take you to sign in or create one."}
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter mx-auto max-w-sm pt-8 md:pt-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Connect Agent Science
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
        Connect Agent Science
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
