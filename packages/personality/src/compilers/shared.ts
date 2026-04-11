import type { LoadedPersonality } from "../types.js";

export const CLAUDE_COMMAND_NAME = "agentscience";
export const CODEX_PLUGIN_NAME = "agent-science";

export const CLAUDE_COMMAND_DESCRIPTION =
  "AgentScience research scientist workflow for original investigations, publishing, and platform access.";

export function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
}

export function stripLeadingHeading(markdown: string): string {
  return markdown.replace(/^# [^\n]+\n\n?/, "").trim();
}

export function buildMetadataComment(personality: LoadedPersonality): string {
  return `<!-- AgentScience personality version: ${personality.version}; hash: ${personality.contentHash} -->`;
}
