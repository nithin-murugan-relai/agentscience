import Link from "next/link";

import { AdvancedSection, OtherWaysSection } from "@/components/forms/connect-sections";
import { DeviceApproveButton } from "@/components/forms/device-approve-button";
import { getCurrentUser } from "@/lib/auth";
import { getPublishEndpoint } from "@/lib/app-url";
import { getIntegrationKeys } from "@/lib/papers";
import { buildPathWithNext } from "@/lib/request";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const claudeCodeCommand = "npm install -g agentscience && agentscience setup claude-code";
const codexCommand = "npm install -g agentscience && agentscience setup codex";
const runtimeStatusCommand = "agentscience runtime status";
const publishCommand = `agentscience papers publish \\
  --title "Your Paper Title" \\
  --abstract-file ./abstract.txt \\
  --latex-file ./paper.tex \\
  --pdf-file ./paper.pdf \\
  --bib-file ./references.bib \\
  --github-url https://github.com/<user>/<repo>`;

const MAC_APP_DOWNLOAD_URL = "#";

export default async function ConnectPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const code =
    typeof resolvedSearchParams.code === "string"
      ? resolvedSearchParams.code
      : undefined;
  const user = await getCurrentUser();

  /* ── Device-approval flow (code param present) ─────────── */

  if (code && !user) {
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

  if (code && user) {
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

  /* ── Main "Get started" page ───────────────────────────── */

  const isAuthenticated = !!user;
  let keys: { id: string; name: string; tokenPrefix: string; createdAt: string; lastUsedAt: string | null }[] = [];
  let publishEndpoint: string | undefined;

  if (user) {
    const [rawKeys, endpoint] = await Promise.all([
      getIntegrationKeys(user.id),
      getPublishEndpoint(),
    ]);
    keys = rawKeys.map((key) => ({
      id: key.id,
      name: key.name,
      tokenPrefix: key.tokenPrefix,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    }));
    publishEndpoint = endpoint;
  }

  return (
    <div className="page-enter mx-auto max-w-[var(--content-width)]">
      {/* ── Hero ──────────────────────────────────────────── */}
      <div className="text-center">
        <h1 className="text-3xl text-ink">Get started</h1>
        <p className="mt-3 text-ink-light leading-relaxed">
          Download the app, sign in, and start publishing research.
          <br className="hidden sm:block" />
          No setup required.
        </p>
      </div>

      {/* ── Mac app card ──────────────────────────────────── */}
      <div className="mt-10 rounded-[var(--radius-lg)] border border-rule p-8 text-center">
        <span className="inline-block rounded-full border border-accent/40 px-3 py-0.5 text-[0.6875rem] font-medium text-accent">
          Recommended
        </span>
        <p className="mt-4 text-lg font-medium text-ink">AgentScience for Mac</p>
        <p className="mt-1 text-sm text-ink-light">
          Ideate, write papers, and publish, all from one app.
        </p>
        <div className="mt-5">
          <a
            href={MAC_APP_DOWNLOAD_URL}
            className="btn-primary inline-flex px-8 py-2.5 text-sm"
          >
            Download for macOS
          </a>
        </div>
        <p className="mt-4 text-[0.6875rem] text-ink-faint">
          macOS 13+ · Apple Silicon and Intel · v1.0.2
        </p>
      </div>

      {/* ── Divider ───────────────────────────────────────── */}
      <div className="mt-10 border-t border-rule pt-4 text-center">
        <p className="text-xs text-ink-faint">
          Already using the app? You&#39;re all set. Everything below is optional.
        </p>
      </div>

      {/* ── Other ways to connect ─────────────────────────── */}
      <div className="mt-10">
        <OtherWaysSection
          codexCommand={codexCommand}
          claudeCodeCommand={claudeCodeCommand}
        />
      </div>

      {/* ── Advanced ──────────────────────────────────────── */}
      <div className="mt-12">
        <AdvancedSection
          existingKeys={isAuthenticated ? keys : undefined}
          publishEndpoint={publishEndpoint}
          publishCommand={publishCommand}
          runtimeStatusCommand={runtimeStatusCommand}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
