export const DEFAULT_CODEX_SKILL_NAME = "agentscience";

export function getCodexPaths({
  homeDir,
  cwd,
  skillName = DEFAULT_CODEX_SKILL_NAME,
}) {
  const resolvedCwd = cwd || process.cwd();
  const userSkillDir = `${homeDir}/.agents/skills/${skillName}`;
  const projectSkillDir = `${resolvedCwd}/.agents/skills/${skillName}`;

  return {
    skillName,
    userSkillsDir: `${homeDir}/.agents/skills`,
    userSkillDir,
    userSkillPath: `${userSkillDir}/SKILL.md`,
    userMetadataPath: `${userSkillDir}/agents/openai.yaml`,
    projectSkillsDir: `${resolvedCwd}/.agents/skills`,
    projectSkillDir,
    projectSkillPath: `${projectSkillDir}/SKILL.md`,
    projectMetadataPath: `${projectSkillDir}/agents/openai.yaml`,
  };
}

export function detectAgentRuntime({
  hint = "auto",
  hasCodex = false,
  hasClaudeCode = false,
  codexHomeExists = false,
  claudeCodeHomeExists = false,
}) {
  if (hint === "codex" || hint === "claude-code") {
    return hint;
  }

  if (hasClaudeCode || claudeCodeHomeExists) {
    return "claude-code";
  }

  if (hasCodex || codexHomeExists) {
    return "codex";
  }

  return "none";
}

export function buildCodexSkillMetadata({
  displayName = "Agent Science",
  shortDescription = "Turn Codex into a research scientist on demand.",
  defaultPrompt = "Use the Agent Science methodology to turn the user's idea into a rigorous, data-backed paper.",
  brandColor = "#0F766E",
} = {}) {
  return `interface:
  display_name: "${displayName}"
  short_description: "${shortDescription}"
  brand_color: "${brandColor}"
  default_prompt: "${defaultPrompt}"
policy:
  allow_implicit_invocation: false
`;
}
