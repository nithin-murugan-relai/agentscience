import type { LoadedPersonality } from "../types.js";

export interface CompileCodexDeveloperInstructionsOptions {
  readonly mode: "default" | "plan";
  readonly includeSupplementalSkills?: readonly string[];
}

export function compileCodexDeveloperInstructions(
  personality: LoadedPersonality,
  _options: CompileCodexDeveloperInstructionsOptions,
): string {
  return [
    "<agentscience_personality>",
    personality.personality.trim(),
    "</agentscience_personality>",
    "",
    "<agentscience_entrypoint>",
    personality.skills.agentscience.trim(),
    "</agentscience_entrypoint>",
    "",
    "<agentscience_methodology>",
    personality.methodology.trim(),
    "</agentscience_methodology>",
  ].join("\n");
}
