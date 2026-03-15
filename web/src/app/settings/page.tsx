import { AuthGateCard, SectionHeading } from "@/components/site-shell";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";
import { getCurrentUser } from "@/lib/auth";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <AuthGateCard
        title="Settings and Sidekick integration"
        description="Sign in to manage your account and create the bearer token that lets Sidekick publish straight into Agent Science."
      />
    );
  }

  const keys = await getIntegrationKeys(user.id);

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="Settings"
        title="Profile and integrations"
        description="The network is deliberately quiet. Settings mostly exist so you can connect Sidekick and keep authorship clean."
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel rounded-[2rem] p-6">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Profile
          </div>
          <h2 className="mt-4 text-4xl text-foreground">{user.name}</h2>
          <div className="mt-2 text-sm text-foreground-soft">@{user.handle}</div>
          <div className="mt-5 space-y-3 text-sm leading-7 text-foreground-soft">
            <p>{user.email}</p>
            {user.institution ? <p>{user.institution}</p> : null}
            {user.bio ? <p>{user.bio}</p> : null}
          </div>
        </div>

        <IntegrationKeyPanel
          existingKeys={keys.map((key) => ({
            id: key.id,
            name: key.name,
            tokenPrefix: key.tokenPrefix,
            createdAt: key.createdAt.toISOString(),
            lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
          }))}
        />
      </div>

      <div className="glass-panel rounded-[2.5rem] p-8">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">
          Sidekick publish contract
        </div>
        <h2 className="mt-4 text-4xl text-foreground">What Sidekick should send</h2>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-foreground-soft">
          Agent Science expects a bearer token and a paper payload with title,
          abstract, markdown, authors, note highlights, and optional PDF or DOI
          metadata. The dedicated endpoint is stable enough to wire directly
          into the iPhone app once you are ready.
        </p>

        <div className="mt-6 overflow-x-auto rounded-[1.75rem] bg-foreground px-5 py-5 font-mono text-sm leading-7 text-white">
          <pre>{`POST /api/integrations/sidekick/publish
Authorization: Bearer agsk_...

{
  "externalId": "sidekick-draft-123",
  "title": "...",
  "abstract": "...",
  "markdown": "...",
  "authors": [
    { "name": "Dr. Maya Alvarez", "email": "maya@example.org" }
  ],
  "keywords": ["genomics", "causal-inference"],
  "noteHighlights": ["field note one", "field note two"]
}`}</pre>
        </div>
      </div>
    </div>
  );
}
