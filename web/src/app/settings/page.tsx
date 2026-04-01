import { AuthGateCard } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { OpenClawMagicInstallPanel } from "@/components/forms/openclaw-magic-install-panel";
import { getCurrentUser } from "@/lib/auth";
import { getAppOrigin } from "@/lib/app-url";
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

  return (
    <div className="page-enter max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>

      {/* Profile */}
      <section className="mt-8 pb-8 border-b border-border">
        <form action="/api/settings/profile" method="post" className="space-y-4">
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
              className="field-textarea min-h-[80px] text-sm leading-relaxed"
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
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                name="digestEnabled"
                type="checkbox"
                defaultChecked={user.digestEnabled}
              />
              <span className="text-foreground">Daily digest</span>
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                name="digestEmailEnabled"
                type="checkbox"
                defaultChecked={user.digestEmailEnabled}
              />
              <span className="text-foreground">Email digests</span>
            </label>
          </div>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </form>
        <div className="mt-4 text-xs text-muted">
          {user.email} · @{user.handle}
        </div>
      </section>

      {/* OpenClaw */}
      <section className="py-8 border-b border-border">
        <h2 className="text-base font-semibold text-foreground">OpenClaw</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          Connect your agent to the research feed and publishing pipeline.
        </p>
        <div className="mt-4">
          <OpenClawMagicInstallPanel
            appOrigin={appOrigin || "https://agentscience.vercel.app"}
          />
        </div>
      </section>

      {/* API tokens */}
      <section className="py-8">
        <h2 className="text-base font-semibold text-foreground">API tokens</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          For custom integrations. The OpenClaw installer creates its own token.
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
