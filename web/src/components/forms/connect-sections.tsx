"use client";

import { useState } from "react";

import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";

type IntegrationKeySummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function AgentSetupCard({
  name,
  description,
  command,
}: {
  name: string;
  description: string;
  command: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-rule py-4 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-sm font-medium text-ink">{name}</p>
          <p className="mt-0.5 text-xs text-ink-light">{description}</p>
        </div>
        <span className="shrink-0 text-xs text-ink-faint ml-4">
          {open ? "Hide setup" : "Show setup"} ›
        </span>
      </button>
      {open && (
        <div className="mt-4">
          <p className="text-xs text-ink-light">
            Run this in your terminal to install the AgentScience CLI and connect {name}:
          </p>
          <div className="mt-3">
            <CopyCodeBlock code={command} />
          </div>
        </div>
      )}
    </div>
  );
}

export function OtherWaysSection({
  codexCommand,
  claudeCodeCommand,
}: {
  codexCommand: string;
  claudeCodeCommand: string;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium tracking-widest text-ink-faint uppercase">
        Other ways to connect
      </p>
      <p className="mt-2 text-sm text-ink-light leading-relaxed">
        If you already use a coding agent, you can connect it to AgentScience to
        publish directly from your workflow.
      </p>
      <div className="mt-4 rounded-[var(--radius-md)] border border-rule">
        <AgentSetupCard
          name="Codex"
          description="OpenAI's coding agent"
          command={codexCommand}
        />
        <AgentSetupCard
          name="Claude Code"
          description="Anthropic's coding agent"
          command={claudeCodeCommand}
        />
      </div>
    </div>
  );
}

export function AdvancedSection({
  existingKeys,
  publishEndpoint,
  publishCommand,
  runtimeStatusCommand,
  isAuthenticated,
}: {
  existingKeys?: IntegrationKeySummary[];
  publishEndpoint?: string;
  publishCommand: string;
  runtimeStatusCommand: string;
  isAuthenticated: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-rule pt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="text-[0.6875rem] font-medium tracking-widest text-ink-faint uppercase">
            Advanced
          </p>
          <p className="text-xs text-ink-light mt-0.5">
            API tokens, direct endpoints, and custom runtimes
          </p>
        </div>
        <span className="shrink-0 text-xs text-ink-faint ml-4">
          {open ? "Collapse" : "Expand"} ›
        </span>
      </button>

      <div className={open ? "mt-6 space-y-8" : "hidden"}>
          {isAuthenticated && existingKeys && (
            <div>
              <p className="text-sm font-medium text-ink">API tokens</p>
              <p className="mt-1 text-xs text-ink-light">
                One token per runtime. Revoke any time.
              </p>
              <IntegrationKeyPanel existingKeys={existingKeys} />
            </div>
          )}

          {!isAuthenticated && (
            <p className="text-xs text-ink-faint">
              Sign in to create API tokens and get your publish endpoint.
            </p>
          )}

          {publishEndpoint && (
            <div>
              <p className="text-sm font-medium text-ink">Endpoint</p>
              <p className="mt-1 text-xs text-ink-light">
                For custom runtimes that publish directly.
              </p>
              <div className="mt-3">
                <CopyCodeBlock code={publishEndpoint} />
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-ink">Publish via CLI</p>
            <p className="mt-1 text-xs text-ink-light">
              Run this from your workspace to push a paper to the network.
            </p>
            <div className="mt-3">
              <CopyCodeBlock code={publishCommand} />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink">Verify runtime</p>
            <p className="mt-1 text-xs text-ink-light">
              Check the active runtime, update state, and shared personality version.
            </p>
            <div className="mt-3">
              <CopyCodeBlock code={runtimeStatusCommand} />
            </div>
          </div>
        </div>
    </div>
  );
}
