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

      {/* Profile */}
      <section className="mt-10 pb-8 border-b border-border/50">
        <h2 className="text-lg font-semibold text-foreground">{user.name}</h2>
        <div className="mt-1 text-sm text-muted">@{user.handle}</div>
        <div className="mt-3 text-sm text-foreground-soft space-y-1">
          <p>{user.email}</p>
          {user.institution && <p>{user.institution}</p>}
          {user.bio && <p>{user.bio}</p>}
        </div>
      </section>

      {/* Sidekick integration */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Sidekick</h2>
        <p className="mt-2 text-sm text-foreground-soft">
          Connect your iPhone to publish directly from Sidekick.
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
