"use client";

import { type FormEvent, useState } from "react";

type IntegrationKeySummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function IntegrationKeyPanel({
  existingKeys,
  publishEndpoint,
}: {
  existingKeys: IntegrationKeySummary[];
  publishEndpoint: string;
}) {
  const [keys, setKeys] = useState(existingKeys);
  const [name, setName] = useState("Sidekick iPhone");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [copied, setCopied] = useState<"endpoint" | "token" | null>(null);

  async function copyValue(value: string, target: "endpoint" | "token") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(target);
      window.setTimeout(() => {
        setCopied((current) => (current === target ? null : current));
      }, 1400);
    } catch {
      setError("Clipboard not available.");
    }
  }

  async function handleCreateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Give this token a name.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
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
        caughtError instanceof Error ? caughtError.message : "Failed to create key."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleDeleteKey(keyId: string) {
    const confirmed = window.confirm("Revoke this Sidekick token?");
    if (!confirmed) {
      return;
    }

    setDeletingKeyId(keyId);
    setError(null);

    try {
      const response = await fetch(`/api/integrations/keys/${keyId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to revoke key.");
      }

      setKeys((currentKeys) => currentKeys.filter((key) => key.id !== keyId));
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to revoke key."
      );
    } finally {
      setDeletingKeyId(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Endpoint */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3">
        <code className="text-sm text-foreground-soft break-all">{publishEndpoint}</code>
        <button
          type="button"
          onClick={() => copyValue(publishEndpoint, "endpoint")}
          className="shrink-0 text-sm text-accent hover:text-accent-hover font-medium"
        >
          {copied === "endpoint" ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Create key */}
      <form onSubmit={handleCreateKey} className="flex gap-3">
        <input
          value={name}
          maxLength={48}
          onChange={(e) => setName(e.target.value)}
          className="field-input text-sm flex-1"
          placeholder="Token name"
        />
        <button
          type="submit"
          disabled={pending || name.trim().length === 0}
          className="btn-primary shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Creating..." : "Create token"}
        </button>
      </form>

      {/* New token display */}
      {token && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-foreground">Token created</div>
              <div className="mt-1 text-xs text-foreground-soft">
                Copy it now. It will not be shown again.
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyValue(token, "token")}
              className="text-sm text-accent hover:text-accent-hover font-medium"
            >
              {copied === "token" ? "Copied" : "Copy"}
            </button>
          </div>
          <code className="mt-3 block rounded-lg bg-foreground px-4 py-3 text-sm text-white break-all">
            {token}
          </code>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Existing keys */}
      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted">
          No active tokens yet.
        </div>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium text-foreground">{key.name}</div>
                <code className="text-xs text-muted">{key.tokenPrefix}...</code>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-xs text-muted">
                  <div>Created {new Date(key.createdAt).toLocaleDateString()}</div>
                  <div>
                    {key.lastUsedAt
                      ? `Used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteKey(key.id)}
                  disabled={deletingKeyId === key.id}
                  className="text-xs font-medium text-muted hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingKeyId === key.id ? "Revoking..." : "Revoke"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
