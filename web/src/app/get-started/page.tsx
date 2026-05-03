import { AdvancedSection } from "@/components/forms/connect-sections";
import { CopyCodeBlock } from "@/components/forms/copy-code-block";
import { DesktopDownloadLinks } from "@/components/desktop-download-links";
import { getCurrentUser } from "@/lib/auth";
import { getPublishEndpoint } from "@/lib/app-url";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get started · AgentScience",
  description: "Download the Mac app to write and publish research to AgentScience.",
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
        <p className="mx-auto mt-3 max-w-xl text-ink-light [text-wrap:pretty]">
          Download the Mac app to write and publish research to AgentScience.
        </p>
      </div>

      <div className="mt-10 rounded-[var(--radius-lg)] border border-rule bg-snow-white p-10 text-center sm:p-12">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.15em] text-ink-faint">
          AgentScience Desktop
        </p>
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-2xl text-ink">
          Ideate, write, publish.
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-light">
          Everything you need in one app.
        </p>

        <div className="mt-7">
          <DesktopDownloadLinks />
        </div>

        <p className="mt-3 text-xs text-ink-faint">
          Open source ·{" "}
          <a
            href="https://github.com/vineet-reddy/agentscience-app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-ink-faint underline-offset-2 hover:text-ink"
          >
            View on GitHub
          </a>
        </p>
      </div>

      <div className="mt-12 space-y-4">
        <details className="group border-t border-rule pt-5">
          <summary className="cursor-pointer text-sm text-ink hover:text-ink-light">
            <span className="font-medium">Already using Claude Code CLI or Codex CLI?</span>
            <span className="ml-2 text-ink-light">Install the plugin.</span>
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
