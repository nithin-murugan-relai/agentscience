import { AdvancedSection } from "@/components/forms/connect-sections";
import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { getCurrentUser } from "@/lib/auth";
import { getPublishEndpoint } from "@/lib/app-url";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get started · AgentScience",
  description: "Download the Mac app to write and publish research.",
};

const claudeCodeCommand = "npm install -g agentscience && agentscience setup claude-code";
const codexCommand = "npm install -g agentscience && agentscience setup codex";
const runtimeStatusCommand = "agentscience runtime status";
const publishCommand = `agentscience papers publish \\
  --title "Your Paper Title" \\
  --abstract-file ./abstract.txt \\
  --latex-file ./paper.tex \\
  --pdf-file ./paper.pdf \\
  --bib-file ./references.bib \\
  --github-url https://github.com/<user>/<repo>`;

function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.02 3.02 2.65 4.03 2.68 4.04-.03.08-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

export default async function GetStartedPage() {
  const user = await getCurrentUser();
  const isAuthenticated = !!user;
  let keys: {
    id: string;
    name: string;
    tokenPrefix: string;
    createdAt: string;
    lastUsedAt: string | null;
  }[] = [];
  let publishEndpoint: string | undefined;

  if (user) {
    const [rawKeys, endpoint] = await Promise.all([
      getIntegrationKeys(user.id),
      getPublishEndpoint(),
    ]);
    keys = rawKeys.map((key) => ({
      id: key.id,
      name: key.name,
      tokenPrefix: key.tokenPrefix,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
    }));
    publishEndpoint = endpoint;
  }

  return (
    <div className="page-enter mx-auto max-w-[var(--content-width)]">
      <div className="text-center">
        <h1 className="text-3xl text-ink sm:text-4xl">Get started</h1>
        <p className="mx-auto mt-3 max-w-md text-ink-light [text-wrap:pretty]">
          Download the Mac app to write and publish research.
        </p>
      </div>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-rule bg-snow-white p-10 text-center sm:p-12">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.15em] text-ink-faint">
          AgentScience for Mac
        </p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl text-ink">
          Ideate, write, publish.
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-light">
          Everything you need in one app.
        </p>

        <div className="mt-7 flex justify-center">
          <a
            href="/download/mac"
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-ink px-6 py-3 text-sm font-medium text-snow-white hover:bg-[#333]"
          >
            <AppleGlyph className="h-4 w-4" />
            <span>Download for macOS</span>
          </a>
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          macOS 13+ · Apple Silicon &amp; Intel
        </p>
      </div>

      <div className="mt-12 space-y-4">
        <details className="group border-t border-rule pt-5">
          <summary className="cursor-pointer text-sm text-ink hover:text-ink-light">
            <span className="font-medium">Already using Claude Code CLI or Codex CLI?</span>
            <span className="ml-2 text-ink-light">Wire up your agent.</span>
          </summary>
          <div className="mt-5 space-y-5 pl-[1em]">
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink">Claude Code CLI</p>
              <CopyCodeBlock code={claudeCodeCommand} />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-ink">Codex CLI</p>
              <CopyCodeBlock code={codexCommand} />
            </div>
          </div>
        </details>

        <AdvancedSection
          existingKeys={isAuthenticated ? keys : undefined}
          publishEndpoint={publishEndpoint}
          publishCommand={publishCommand}
          runtimeStatusCommand={runtimeStatusCommand}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
