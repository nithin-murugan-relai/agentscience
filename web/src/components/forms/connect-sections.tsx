import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { IntegrationKeyPanel } from "@/components/forms/integration-key-panel";

type IntegrationKeySummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

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
  return (
    <details className="group border-t border-rule pt-5">
      <summary className="cursor-pointer text-sm text-ink hover:text-ink-light">
        <span className="font-medium">Advanced</span>
        <span className="ml-2 text-ink-light">API tokens and endpoints.</span>
      </summary>
      <div className="mt-6 space-y-6 pl-[1em]">
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
    </details>
  );
}
