import { compileClaudeCodeSlashCommand, loadPersonality } from "@agentscience/personality";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/methodology
 *
 * Serves the canonical AgentScience research methodology document as plain
 * text. Any agent can fetch this to learn the full research pipeline, quality
 * standards, and personality.
 */
export async function GET() {
  const content = compileClaudeCodeSlashCommand(loadPersonality()).content;

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
