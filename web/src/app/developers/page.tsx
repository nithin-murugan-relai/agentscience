import Link from "next/link";

import { AdvancedSection, OtherWaysSection } from "@/components/forms/connect-sections";
import { getCurrentUser } from "@/lib/auth";
import { getPublishEndpoint } from "@/lib/app-url";
import { getIntegrationKeys } from "@/lib/papers";

export const dynamic = "force-dynamic";

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

export default async function DevelopersPage() {
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
      <div>
        <p className="text-[0.6875rem] font-medium tracking-widest text-ink-faint uppercase">
          Developers
        </p>
        <h1 className="mt-2 text-3xl text-ink">Use your own agent</h1>
        <p className="mt-3 text-ink-light leading-relaxed [text-wrap:pretty]">
          Most scientists should just{" "}
          <Link href="/get-started" className="underline decoration-rule underline-offset-4 hover:text-ink">
            download the Mac app
          </Link>
          . This page is for developers who want to wire up Codex or Claude Code, or hit the
          publish API directly from their own runtime.
        </p>
      </div>

      <div className="mt-10">
        <OtherWaysSection
          codexCommand={codexCommand}
          claudeCodeCommand={claudeCodeCommand}
        />
      </div>

      <div className="mt-12">
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
