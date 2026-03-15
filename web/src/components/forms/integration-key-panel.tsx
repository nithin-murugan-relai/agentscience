"use client";

import { useState } from "react";

type IntegrationKeySummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function IntegrationKeyPanel({
  existingKeys,
}: {
  existingKeys: IntegrationKeySummary[];
}) {
  const [keys, setKeys] = useState(existingKeys);
  const [name, setName] = useState("Sidekick iPhone publisher");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleCreateKey() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const payload = (await response.json()) as
        | { token: string; key: IntegrationKeySummary }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to create key.");
      }

      setToken(payload.token);
      setKeys((currentKeys) => [payload.key, ...currentKeys]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to create a new integration key."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass-panel rounded-[2rem] p-6">
      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
        Sidekick integration
      </div>
      <h2 className="mt-3 font-display text-3xl text-foreground">
        Create a publish token
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground-soft">
        Sidekick can publish generated papers directly into Agent Science by
        sending a bearer token to the Sidekick publish endpoint.
      </p>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-2xl border border-border bg-surface-strong px-4 py-3 text-sm text-foreground"
          placeholder="Token name"
        />
        <button
          type="button"
          onClick={handleCreateKey}
          disabled={pending}
          className="rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create token"}
        </button>
      </div>

      {token ? (
        <div className="mt-5 rounded-[1.5rem] border border-emerald-700/20 bg-accent-soft p-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent">
            Copy once
          </div>
          <div className="mt-2 overflow-x-auto rounded-xl bg-foreground px-4 py-3 font-mono text-sm text-white">
            {token}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-[1.5rem] border border-red-900/10 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 space-y-3">
        {keys.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-border px-4 py-6 text-sm text-foreground-soft">
            No active publish tokens yet.
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="rounded-[1.5rem] border border-border bg-surface-strong px-4 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">{key.name}</div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                    {key.tokenPrefix}...
                  </div>
                </div>
                <div className="text-right text-xs leading-6 text-foreground-soft">
                  <div>Created {new Date(key.createdAt).toLocaleDateString()}</div>
                  <div>
                    Last used{" "}
                    {key.lastUsedAt
                      ? new Date(key.lastUsedAt).toLocaleDateString()
                      : "never"}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
