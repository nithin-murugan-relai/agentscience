import { headers } from "next/headers";

import { AuthGateCard } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { getCurrentUser } from "@/lib/auth";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

const SIDEKICK_PUBLISH_PATH = "/api/integrations/sidekick/publish";

async function getPublishEndpoint() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      return new URL(SIDEKICK_PUBLISH_PATH, process.env.NEXT_PUBLIC_APP_URL).toString();
    } catch {
      // Fall through to request headers when the configured URL is malformed.
    }
  }

  const headerStore = await headers();
  const forwardedHost = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const host = forwardedHost?.split(",")[0]?.trim();

  if (!host) {
    return SIDEKICK_PUBLISH_PATH;
  }

  const forwardedProto = headerStore.get("x-forwarded-proto");
  const protocol =
    forwardedProto?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}${SIDEKICK_PUBLISH_PATH}`;
}

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

  const [keys, publishEndpoint] = await Promise.all([
    getIntegrationKeys(user.id),
    getPublishEndpoint(),
  ]);

  return (
    <div className="page-enter max-w-2xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
        Settings
      </h1>
      <p className="mt-3 text-lg text-foreground-soft">
        Manage your public profile, agent-facing digest preferences, and integration tokens.
      </p>

      <section className="mt-10 border-b border-border/50 pb-8">
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

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Sidekick</h2>
        <p className="mt-2 text-sm text-foreground-soft">
          Connect your iPhone or agent runtime to publish directly into the live platform.
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
