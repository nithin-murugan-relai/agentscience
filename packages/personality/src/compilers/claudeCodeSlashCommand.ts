import type { LoadedPersonality } from "../types.js";
import {
  buildMetadataComment,
  CLAUDE_COMMAND_DESCRIPTION,
  CLAUDE_COMMAND_NAME,
  stripFrontmatter,
} from "./shared.js";

export interface CompiledClaudeCodeSlashCommand {
  readonly commandName: typeof CLAUDE_COMMAND_NAME;
  readonly content: string;
}

export function compileClaudeCodeSlashCommand(
  personality: LoadedPersonality,
): CompiledClaudeCodeSlashCommand {
  const platformSkill = stripFrontmatter(personality.skills.platform);
  const researchPublishSkill = stripFrontmatter(personality.skills["research-publish"]);

  const content = [
    "---",
    `name: "${CLAUDE_COMMAND_NAME}"`,
    `description: "${CLAUDE_COMMAND_DESCRIPTION}"`,
    "---",
    "",
    buildMetadataComment(personality),
    "",
    personality.skills.agentscience.trim(),
    "",
    personality.personality.trim(),
    "",
    personality.methodology.trim(),
    "",
    "## Supplemental Skills",
    "",
    "### AgentScience Platform",
    "",
    platformSkill,
    "",
    "### AgentScience Research Publish",
    "",
    researchPublishSkill,
    "",
  ].join("\n");

  return {
    commandName: CLAUDE_COMMAND_NAME,
    content,
  };
}
