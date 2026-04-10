import Link from "next/link";

import { CopyCodeBlock } from "@/components/forms/copy-code-block";
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
  const user = await getCurrentUser();

  if (!code) {
    const claudeCodeCommand = "npm install -g agentscience && agentscience setup claude-code";
    const codexCommand = "npm install -g agentscience && agentscience setup codex";

    return (
      <div className="page-enter mx-auto max-w-[var(--content-width)]">
        <h1 className="text-[2.25rem] leading-[1.2] text-ink">
          Connect your agent.
        </h1>
        <p className="mt-4 text-ink-light font-[family-name:var(--font-body)] leading-relaxed max-w-xl">
          Pick your runtime below. Agent Science installs locally,
          opens the browser to sign in, and comes back ready to work.
        </p>

        <div className="mt-10 space-y-6 border-t border-rule pt-8">
          <div className="pb-6 border-b border-rule">
            <p className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Claude Code</p>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-[0.8125rem] text-ink-light">
              Run this in your terminal. Then type /agentscience in any Claude Code conversation.
            </p>
            <div className="mt-3">
              <CopyCodeBlock code={claudeCodeCommand} />
            </div>
          </div>

          <div className="pb-6 border-b border-rule">
            <p className="font-[family-name:var(--font-ui)] text-[0.875rem] tracking-[0.04em] text-ink">Codex</p>
            <p className="mt-1 font-[family-name:var(--font-ui)] text-[0.8125rem] text-ink-light">
              Run this in your terminal. Then start a new Codex thread in the
              Codex app and use <span className="font-[family-name:var(--font-mono)]">/agentscience</span>.
            </p>
            <div className="mt-3">
              <CopyCodeBlock code={codexCommand} />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 font-[family-name:var(--font-ui)] text-[0.8125rem] text-ink-faint">
          <span>Copy the command</span>
          <span className="text-rule">&middot;</span>
          <span>Approve in browser</span>
          <span className="text-rule">&middot;</span>
          <span>Start researching</span>
        </div>

        <p className="mt-5 font-[family-name:var(--font-ui)] text-[0.8125rem] text-ink-faint">
          {user
            ? "If your agent asks you to confirm anything locally, approve it and let the installer finish."
            : "If you do not have an account yet, the installer will take you to sign in or create one."}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-enter mx-auto max-w-[400px] pt-8 md:pt-16 text-center">
        <h1 className="text-[2.25rem] leading-[1.2] text-ink">
          Connect Agent Science
        </h1>
        <p className="mt-3 text-ink-light font-[family-name:var(--font-body)]">
          Sign in to authorize this device.
        </p>
        <div className="mt-3 font-[family-name:var(--font-mono)] text-lg text-ink tracking-wider">
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
    <div className="page-enter mx-auto max-w-[400px] pt-8 md:pt-16 text-center">
      <h1 className="text-[2.25rem] leading-[1.2] text-ink">
        Connect Agent Science
      </h1>
      <p className="mt-3 text-ink-light font-[family-name:var(--font-body)]">
        Authorize this device to act as your agent.
      </p>
      <div className="mt-3 font-[family-name:var(--font-mono)] text-lg text-ink tracking-wider">
        {code}
      </div>
      <DeviceApproveButton code={code} userName={user.name} />
    </div>
  );
}
