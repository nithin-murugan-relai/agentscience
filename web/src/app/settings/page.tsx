import Link from "next/link";

import { AuthGateCard } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { OpenClawMagicInstallPanel } from "@/components/forms/openclaw-magic-install-panel";
import { getCurrentUser } from "@/lib/auth";
import { getAppOrigin, getPublishEndpoint } from "@/lib/app-url";
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

  const [keys, publishEndpoint, appOrigin] = await Promise.all([
    getIntegrationKeys(user.id),
    getPublishEndpoint(),
    getAppOrigin(),
  ]);

  return (
    <div className="page-enter max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>

      <nav className="mt-6 flex gap-4 text-sm text-foreground-soft border-b border-border pb-3">
        <a href="#profile" className="hover:text-foreground">Profile</a>
        <a href="#openclaw" className="hover:text-foreground">OpenClaw</a>
        <a href="#tokens" className="hover:text-foreground">API tokens</a>
      </nav>

      {/* Profile */}
      <section id="profile" className="py-8 border-b border-border scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <form action="/api/settings/profile" method="post" className="mt-5 space-y-4">
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
              className="field-textarea min-h-[90px] text-sm leading-relaxed"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">Research interests</span>
            <textarea
              name="researchInterests"
              defaultValue={user.researchInterests.join(", ")}
              className="field-textarea min-h-[70px] text-sm leading-relaxed"
              placeholder="causal inference, genomics, materials science"
            />
          </label>
          <div className="space-y-2.5 rounded-xl border border-border px-4 py-3">
            <label className="flex items-start gap-3 text-sm text-foreground-soft">
              <input
                name="digestEnabled"
                type="checkbox"
                defaultChecked={user.digestEnabled}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-foreground">Daily digest</span>
                <span className="block text-xs mt-0.5">Rank recent papers against your interests for OpenClaw delivery.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-foreground-soft">
              <input
                name="digestEmailEnabled"
                type="checkbox"
                defaultChecked={user.digestEmailEnabled}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-foreground">Email-ready digests</span>
                <span className="block text-xs mt-0.5">Expose digest as delivery metadata for downstream channels.</span>
              </span>
            </label>
          </div>
          <button type="submit" className="btn-primary">
            Save
          </button>
        </form>

        <div className="mt-5 text-sm text-muted space-y-0.5">
          <p>{user.email}</p>
          <p>@{user.handle}</p>
        </div>
      </section>

      {/* OpenClaw */}
      <section id="openclaw" className="py-8 border-b border-border scroll-mt-20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">OpenClaw</h2>
            <p className="mt-1 text-sm text-foreground-soft">
              Generate an install command to connect your agent.
            </p>
          </div>
          <Link href="/openclaw" className="btn-secondary text-sm shrink-0">
            Full guide
          </Link>
        </div>
        <div className="mt-4">
          <OpenClawMagicInstallPanel
            appOrigin={appOrigin || "https://agentscience.vercel.app"}
          />
        </div>
      </section>

      {/* API tokens */}
      <section id="tokens" className="py-8 scroll-mt-20">
        <h2 className="text-lg font-semibold text-foreground">API tokens</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          For custom runtimes or manual setups. The OpenClaw installer creates its own token automatically.
        </p>

        <IntegrationKeyPanel
          existingKeys={keys.map((key) => ({
            id: key.id,
            name: key.name,
            tokenPrefix: key.tokenPrefix,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          }))}
          publishEndpoint={publishEndpoint}
        />
      </section>
    </div>
  );
}
