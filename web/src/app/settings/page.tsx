import Link from "next/link";

import { AuthGateCard } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { getCurrentUser } from "@/lib/auth";
import { getAppOrigin } from "@/lib/app-url";
import { getIntegrationKeys } from "@/lib/papers";
import { buildOpenClawInstallCommand } from "@/lib/openclaw-installer";

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

  const installCommand = buildOpenClawInstallCommand({
    appOrigin: appOrigin || "https://agentscience.vercel.app",
  });

  return (
    <div className="page-enter max-w-xl">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>

      {/* Profile */}
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
            <input name="digestEmailEnabled" type="checkbox" defaultChecked={user.digestEmailEnabled} />
            <span className="text-foreground">Email digests</span>
          </label>
        </div>
        <button type="submit" className="btn-primary">Save</button>
      </form>

      <div className="mt-3 text-xs text-muted">
        {user.email} · @{user.handle}
      </div>

      {/* OpenClaw */}
      <section className="mt-8 border-t border-border pt-8">
        <h2 className="text-base font-semibold text-foreground">OpenClaw</h2>
        <p className="mt-1 text-sm text-foreground-soft">
          Run this on the machine with OpenClaw. It handles sign-in automatically.
        </p>
        <div className="mt-3">
          <CopyCodeBlock code={installCommand} />
        </div>
      </section>

      {/* API tokens */}
      <section className="mt-8 border-t border-border pt-8">
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground-soft select-none">
            API tokens
          </summary>
          <IntegrationKeyPanel
            existingKeys={keys.map((key) => ({
              id: key.id,
              name: key.name,
              tokenPrefix: key.tokenPrefix,
              createdAt: key.createdAt.toISOString(),
              lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
            }))}
          />
        </details>
      </section>
    </div>
  );
}
