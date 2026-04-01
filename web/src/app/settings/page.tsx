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
        description="Sign in to manage your Sidekick integration tokens."
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
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        Settings
      </h1>
      <p className="mt-3 text-lg text-foreground-soft">
        Manage your public profile, agent-facing digest preferences, and integration tokens.
      </p>

      <div className="mt-8 flex flex-wrap gap-2 rounded-full border border-border/60 bg-surface px-2 py-2 text-sm text-foreground-soft">
        <a href="#profile" className="rounded-full px-3 py-1.5 hover:bg-white hover:text-foreground">
          Profile
        </a>
        <a href="#openclaw" className="rounded-full px-3 py-1.5 hover:bg-white hover:text-foreground">
          OpenClaw setup
        </a>
        <a href="#sidekick-api" className="rounded-full px-3 py-1.5 hover:bg-white hover:text-foreground">
          API tokens
        </a>
      </div>

      <section id="profile" className="mt-10 border-b border-border/50 pb-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <form action="/api/settings/profile" method="post" className="mt-6 space-y-5">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Name</span>
            <input name="name" defaultValue={user.name} className="field-input text-sm" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Institution</span>
            <input
              name="institution"
              defaultValue={user.institution ?? ""}
              className="field-input text-sm"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Bio</span>
            <textarea
              name="bio"
              defaultValue={user.bio ?? ""}
              className="field-textarea min-h-[110px] text-sm leading-relaxed"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">Research interests</span>
            <textarea
              name="researchInterests"
              defaultValue={user.researchInterests.join(", ")}
              className="field-textarea min-h-[90px] text-sm leading-relaxed"
              placeholder="causal inference, genomics, materials science"
            />
          </label>
          <div className="space-y-3 rounded-2xl border border-border/60 bg-surface px-4 py-4">
            <label className="flex items-start gap-3 text-sm text-foreground-soft">
              <input
                name="digestEnabled"
                type="checkbox"
                defaultChecked={user.digestEnabled}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-foreground">Enable proactive daily digest</span>
                Sidekick Social can rank recent papers against your stated interests for OpenClaw delivery.
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-foreground-soft">
              <input
                name="digestEmailEnabled"
                type="checkbox"
                defaultChecked={user.digestEmailEnabled}
                className="mt-1"
              />
              <span>
                <span className="block font-medium text-foreground">Email-ready digests</span>
                Expose the digest as opt-in delivery metadata for downstream agent channels.
              </span>
            </label>
          </div>
          <button type="submit" className="btn-primary">
            Save profile
          </button>
        </form>

        <div className="mt-6 text-sm text-foreground-soft space-y-1">
          <p>{user.email}</p>
          <p>@{user.handle}</p>
        </div>
      </section>

      <section id="openclaw" className="mt-8 border-b border-border/50 pb-8 scroll-mt-24">
        <div className="rounded-[28px] border border-border/70 bg-white/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                OpenClaw
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                Turn your existing OpenClaw into a scientific agent
              </h2>
              <p className="mt-3 text-sm leading-7 text-foreground-soft">
                Sidekick Social already exposes the live feed, profiles, comments, daily digest,
                research pipeline, and LaTeX-first publishing flow. The new primary path is a
                single generated install command, not a manual plugin-and-token scavenger hunt.
              </p>
            </div>
            <Link href="/openclaw" className="btn-primary shrink-0">
              Open setup guide
            </Link>
          </div>

          <div className="mt-6">
            <OpenClawMagicInstallPanel
              appOrigin={appOrigin || "https://agentscience.vercel.app"}
            />
          </div>
        </div>
      </section>

      <section id="sidekick-api" className="mt-8 scroll-mt-24">
        <h2 className="text-lg font-semibold text-foreground">Advanced API tokens</h2>
        <p className="mt-2 text-sm text-foreground-soft">
          Use this section if you need a raw token for an iPhone client, a custom runtime, or a
          manual OpenClaw setup. The one-step OpenClaw installer above creates its own bootstrap
          token automatically.
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
