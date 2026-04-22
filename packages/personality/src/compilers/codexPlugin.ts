import type { LoadedPersonality } from "../types.js";
import { buildMetadataComment, CODEX_PLUGIN_NAME, stripLeadingHeading } from "./shared.js";

export interface CompiledCodexPlugin {
  readonly pluginName: typeof CODEX_PLUGIN_NAME;
  readonly files: Readonly<Record<string, string | Buffer>>;
  readonly marketplaceEntry: {
    readonly name: string;
    readonly source: {
      readonly source: "local";
      readonly path: string;
    };
    readonly policy: {
      readonly installation: "AVAILABLE";
      readonly authentication: "ON_INSTALL";
    };
    readonly category: "Research";
  };
}

function buildPluginManifest(personality: LoadedPersonality) {
  return {
    name: CODEX_PLUGIN_NAME,
    version: personality.version,
    description:
      "Installable AgentScience workflows for research, publishing, and platform access through the canonical CLI.",
    author: {
      name: "Vineet Reddy",
      url: "https://github.com/vineet-reddy",
    },
    homepage: "https://agentscience.app",
    repository: "https://github.com/vineet-reddy/agentscience",
    license: "MIT",
    keywords: ["agentscience", "research", "publishing", "science", "cli"],
    skills: "./skills/",
    interface: {
      displayName: personality.manifest.displayName,
      shortDescription: "Research, publish, and inspect AgentScience directly from Codex",
      longDescription:
        "Bundles AgentScience skills for research methodology, platform access, and paper publishing through the canonical `agentscience` CLI.",
      developerName: personality.manifest.displayName,
      category: "Research",
      capabilities: ["Interactive", "Read", "Write"],
      websiteURL: "https://agentscience.app",
      defaultPrompt: [
        "Use AgentScience like a demanding co-scientist: refine the question with me before you touch code, and push back until it is novel, testable, and worth doing.",
        "Use AgentScience to inspect papers, rankings, profiles, and my digest through the canonical CLI.",
        "Once the question is locked, use AgentScience to build or publish a paper bundle without hand-waving or fake results.",
      ],
      brandColor: "#0f766e",
      screenshots: [],
    },
  };
}

function buildAgentScienceSkill(personality: LoadedPersonality): string {
  return [
    "---",
    'name: "agentscience"',
    'description: "Use when the user wants to write a research paper, conduct scientific research, publish to AgentScience, find datasets, run experiments, do literature review, or anything related to scientific publishing. Also activate when the user mentions AgentScience, agentscience, papers, research ideas, or scientific investigations."',
    "---",
    "",
    buildMetadataComment(personality),
    "",
    "# AgentScience Research Methodology",
    "",
    stripLeadingHeading(personality.skills.agentscience),
    "",
    stripLeadingHeading(personality.personality),
    "",
    stripLeadingHeading(personality.methodology),
    "",
  ].join("\n");
}

export function compileCodexPlugin(personality: LoadedPersonality): CompiledCodexPlugin {
  const files: Record<string, string | Buffer> = {
    ".codex-plugin/plugin.json": `${JSON.stringify(buildPluginManifest(personality), null, 2)}\n`,
    "skills/agentscience/SKILL.md": buildAgentScienceSkill(personality),
    "skills/agent-science-platform/SKILL.md": personality.skills.platform,
    "skills/agent-science-research-publish/SKILL.md": personality.skills["research-publish"],
  };

  for (const [assetPath, buffer] of Object.entries(personality.assets)) {
    files[`assets/${assetPath}`] = buffer;
  }

  return {
    pluginName: CODEX_PLUGIN_NAME,
    files,
    marketplaceEntry: {
      name: CODEX_PLUGIN_NAME,
      source: {
        source: "local",
        path: `./plugins/${CODEX_PLUGIN_NAME}`,
      },
      policy: {
        installation: "AVAILABLE",
        authentication: "ON_INSTALL",
      },
      category: "Research",
    },
  };
}
