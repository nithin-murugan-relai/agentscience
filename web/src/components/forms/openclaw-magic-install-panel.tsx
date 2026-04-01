"use client";

import { useEffect, useState } from "react";

import { buildOpenClawInstallCommand } from "@/lib/openclaw-installer";

const CACHE_KEY = "openclaw_install_command";

export function OpenClawMagicInstallPanel({
  appOrigin,
}: {
  appOrigin: string;
}) {
  const [command, setCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
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
        throw new Error("error" in payload ? payload.error : "Something went wrong.");
      }

      const cmd = buildOpenClawInstallCommand({ appOrigin, token: payload.token });
      try { localStorage.setItem(CACHE_KEY, cmd); } catch {}
      setCommand(cmd);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setCommand(cached);
        setLoading(false);
        return;
      }
    } catch {}
    generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (loading) {
    return <p className="text-sm text-muted">Preparing install command...</p>;
  }

  if (error && !command) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-foreground-soft">
          Paste on the machine running OpenClaw.
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
      <button
        type="button"
        onClick={generate}
        className="mt-2 text-xs text-muted hover:text-foreground-soft"
      >
        Regenerate with new token
      </button>
      {error && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
