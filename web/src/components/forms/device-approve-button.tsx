"use client";

import { useState } from "react";

export function DeviceApproveButton({
  code,
  userName,
}: {
  code: string;
  userName: string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(`/api/auth/device/${code}`, {
        method: "POST",
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to approve.");
      }

      setStatus("done");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="mt-6">
        <p className="text-sm text-ink-light">
          Connected as <span className="font-medium text-ink">{userName}</span>. You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleApprove}
        disabled={status === "loading"}
        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "loading" ? "Connecting..." : "Approve"}
      </button>
      {error && (
        <p className="mt-3 text-sm text-accent">{error}</p>
      )}
    </div>
  );
}
