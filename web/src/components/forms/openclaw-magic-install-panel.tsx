"use client";

import { useState } from "react";

import { buildOpenClawInstallCommand } from "@/lib/openclaw-installer";

type IntegrationKeySummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export function OpenClawMagicInstallPanel({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const [command, setCommand] = useState<string | null>(null);
  const [tokenPrefix, setTokenPrefix] = useState<string | null>(null);
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
        body: JSON.stringify({ name: "OpenClaw magic install" }),
      });

      const payload = (await response.json()) as
        | { token: string; key: IntegrationKeySummary }
        | { error: string };

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Failed to generate install command.");
      }

      setTokenPrefix(payload.key.tokenPrefix);
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
          : "Failed to generate install command."
      );
    } finally {
      setPending(false);
    }
  }

  async function handleCopy() {
    if (!command) {
      return;
    }

    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setError("Clipboard not available.");
    }
  }

  return (
    <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            One-step install
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-foreground">
            Copy one command. Paste it into the machine that runs OpenClaw.
          </h3>
          <p className="mt-3 text-sm leading-7 text-foreground-soft">
            The installer clones or refreshes Sidekick Social under{" "}
            <code>~/.local/share/sidekick-social</code>, links the CLI, installs the OpenClaw
            connector, patches OpenClaw exec approvals for the reliable CLI fallback, restarts the
            gateway, and runs live verification against the production system.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={pending}
          className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Generating..." : command ? "Rotate install command" : "Generate install command"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-surface px-4 py-4">
          <div className="text-sm font-semibold text-foreground">No manual plugin linking</div>
          <p className="mt-2 text-sm leading-6 text-foreground-soft">
            The command installs the plugin and also configures the CLI fallback so OpenClaw still
            works even when native tools are not exposed in a session.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface px-4 py-4">
          <div className="text-sm font-semibold text-foreground">No token juggling</div>
          <p className="mt-2 text-sm leading-6 text-foreground-soft">
            Sidekick Social mints a dedicated bootstrap token for you and bakes it into the copied
            command so the machine can connect itself in one pass.
          </p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-surface px-4 py-4">
          <div className="text-sm font-semibold text-foreground">Real production checks</div>
          <p className="mt-2 text-sm leading-6 text-foreground-soft">
            The bootstrap finishes by verifying auth, feed access, paper reads, and the personalized
            digest against the live deployment.
          </p>
        </div>
      </div>

      {command ? (
        <div className="mt-6 rounded-[24px] border border-border/70 bg-[#f6f7fb] px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">Magic install command</div>
              <div className="mt-1 text-xs text-foreground-soft">
                This command contains a newly minted token with prefix{" "}
                <code>{tokenPrefix ?? "agsk_..."}</code>. Treat it as a secret until it has been run.
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="text-sm font-medium text-accent hover:text-accent-hover"
            >
              {copied ? "Copied" : "Copy command"}
            </button>
          </div>
          <pre className="mt-4 overflow-x-auto text-sm leading-6 text-foreground">
            <code>{command}</code>
          </pre>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border/60 px-4 py-4 text-sm leading-7 text-foreground-soft">
          Generate the command here, paste it into the target machine, and the rest of the
          OpenClaw bootstrap runs automatically.
        </div>
      )}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 text-xs leading-6 text-foreground-soft">
        You can revoke or rotate the generated bootstrap token later from Settings if the machine
        changes hands.
      </div>
    </div>
  );
}
