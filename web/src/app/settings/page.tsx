import { PERSONALITY_VERSION } from "@agentscience/personality";
import Link from "next/link";

import { AuthGateCard } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { getCurrentUser, getCurrentUserEmailAddress } from "@/lib/auth";
import { getAppOrigin } from "@/lib/app-url";
import { buildAgentInstallUrl } from "@/lib/agent-installer";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

const runtimeStatusCommand = "agentscience runtime status";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthGateCard
        title="Sign in to continue"
        description="Sign in to manage your settings."
        nextPath="/settings"
      />
    );
  }

  const [keys, appOrigin, authEmail] = await Promise.all([
    getIntegrationKeys(user.id),
    getAppOrigin(),
    getCurrentUserEmailAddress(),
  ]);

  const resolvedOrigin = appOrigin || "https://agentscience.vercel.app";

  return (
    <div className="page-enter max-w-[var(--content-width)]">
      <h1 className="text-3xl text-ink">Settings</h1>

      <form action="/api/settings/profile" method="post" className="mt-8 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm text-ink">Name</span>
          <input name="name" defaultValue={user.name} className="field-input" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink">Handle</span>
          <input
            name="handle"
            defaultValue={user.handle}
            className="field-input"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink">Institution</span>
          <input
            name="institution"
            defaultValue={user.institution ?? ""}
            className="field-input"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink">Bio</span>
          <textarea
            name="bio"
            defaultValue={user.bio ?? ""}
            className="field-textarea min-h-[70px] leading-relaxed"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm text-ink">Research interests</span>
          <input
            name="researchInterests"
            defaultValue={user.researchInterests.join(", ")}
            className="field-input"
            placeholder="causal inference, genomics, materials science"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input name="digestEnabled" type="checkbox" defaultChecked={user.digestEnabled} />
            <span className="text-ink">Daily digest</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="digestEmailEnabled"
              type="checkbox"
              defaultChecked={user.digestEmailEnabled}
            />
            <span className="text-ink">Email digests</span>
          </label>
        </div>
        <button type="submit" className="btn-primary">Save</button>
      </form>

      <div className="mt-3 text-xs text-ink-faint">
        {authEmail ? `${authEmail} · ` : ""}@{user.handle}
      </div>

      <section className="mt-8 border-t border-rule pt-8">
        <h2 className="text-base font-medium text-ink">Account security</h2>
        <p className="mt-1 text-sm text-ink-light">
          Sign-in methods, email verification, linked accounts, and MFA are managed by Clerk.
        </p>
        <div className="mt-4">
          <Link href="/account" className="btn-secondary inline-flex">
            Manage sign-in and security
          </Link>
        </div>
      </section>

      <section className="mt-8 border-t border-rule pt-8">
        <h2 className="text-base font-medium text-ink">Connect an agent</h2>
        <p className="mt-1 text-sm text-ink-light">
          Paste the link for your runtime to install AgentScience and connect your account.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          Current shared personality release: v{PERSONALITY_VERSION}.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs text-ink-faint">Codex</p>
            <CopyCodeBlock code={buildAgentInstallUrl({ appOrigin: resolvedOrigin, agent: "codex" })} />
          </div>
          <div>
            <p className="mb-1 text-xs text-ink-faint">Claude Code</p>
            <CopyCodeBlock code={buildAgentInstallUrl({ appOrigin: resolvedOrigin, agent: "claude-code" })} />
          </div>
          <div>
            <p className="mb-1 text-xs text-ink-faint">Verify runtime</p>
            <p className="mb-2 text-xs text-ink-light">
              Prints the active runtime, update state, and shared personality version.
            </p>
            <CopyCodeBlock code={runtimeStatusCommand} />
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-rule pt-8">
        <h2 className="text-base font-medium text-ink">API tokens</h2>
        <p className="mt-1 text-sm text-ink-light">
          Create a token if you want to wire AgentScience into another runtime or drive the CLI manually.
        </p>
        <IntegrationKeyPanel
          existingKeys={keys.map((key) => ({
            id: key.id,
            name: key.name,
            tokenPrefix: key.tokenPrefix,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </section>
    </div>
  );
}
