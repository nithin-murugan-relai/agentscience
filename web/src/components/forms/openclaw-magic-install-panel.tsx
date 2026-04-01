"use client";

import { useState } from "react";

import { buildOpenClawInstallCommand } from "@/lib/openclaw-installer";

export function OpenClawMagicInstallPanel({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const [command, setCommand] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "OpenClaw bootstrap" }),
      });

      const payload = (await response.json()) as
        | { token: string; key: { id: string; tokenPrefix: string } }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to generate command.");
      }

      setCommand(
        buildOpenClawInstallCommand({
          appOrigin,
          token: payload.token,
        })
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Failed to generate command."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Clipboard not available.");
    }
  }

  if (!command) {
    return (
      <div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Generating..." : "Generate install command"}
        </button>
        <p className="mt-2 text-xs text-muted">
          Creates a token and builds a one-line install command for your machine.
        </p>
        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-foreground-soft">
          Paste this on the machine running OpenClaw. Treat it as a secret.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-sm font-medium text-accent hover:text-accent-hover"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-xl border border-border bg-[#f6f7fb] px-4 py-3 text-sm leading-6 text-foreground">
        <code>{command}</code>
      </pre>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-50"
        >
          {pending ? "Generating..." : "Regenerate"}
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
