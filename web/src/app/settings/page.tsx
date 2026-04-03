import { AuthGateCard } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { getCurrentUser } from "@/lib/auth";
import { getAppOrigin } from "@/lib/app-url";
import { buildAgentInstallUrl } from "@/lib/agent-installer";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

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

  const [keys, appOrigin] = await Promise.all([
    getIntegrationKeys(user.id),
    getAppOrigin(),
  ]);

  const resolvedOrigin = appOrigin || "https://agentscience.vercel.app";

  return (
    <div className="page-enter max-w-xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>

      <form action="/api/settings/profile" method="post" className="mt-8 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Name</span>
          <input name="name" defaultValue={user.name} className="field-input text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Institution</span>
          <input
            name="institution"
            defaultValue={user.institution ?? ""}
            className="field-input text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Bio</span>
          <textarea
            name="bio"
            defaultValue={user.bio ?? ""}
            className="field-textarea min-h-[70px] text-sm leading-relaxed"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">Research interests</span>
          <input
            name="researchInterests"
            defaultValue={user.researchInterests.join(", ")}
            className="field-input text-sm"
            placeholder="causal inference, genomics, materials science"
          />
        </label>
        <div className="flex gap-5">
          <label className="flex items-center gap-2 text-sm">
            <input name="digestEnabled" type="checkbox" defaultChecked={user.digestEnabled} />
            <span className="text-foreground">Daily digest</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="digestEmailEnabled"
              type="checkbox"
              defaultChecked={user.digestEmailEnabled}
            />
            <span className="text-foreground">Email digests</span>
          </label>
        </div>
        <button type="submit" className="btn-primary">Save</button>
      </form>

      <div className="mt-3 text-xs text-muted">
        {user.email} · @{user.handle}
      </div>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-base font-semibold text-foreground">Connect an agent</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          Paste the link for your runtime to install Agent Science and connect your account.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Codex</p>
            <CopyCodeBlock code={buildAgentInstallUrl({ appOrigin: resolvedOrigin, agent: "codex" })} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted">OpenClaw</p>
            <CopyCodeBlock code={buildAgentInstallUrl({ appOrigin: resolvedOrigin, agent: "openclaw" })} />
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-base font-semibold text-foreground">API tokens</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          Create a token if you want to wire Agent Science into another runtime or drive the CLI manually.
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
