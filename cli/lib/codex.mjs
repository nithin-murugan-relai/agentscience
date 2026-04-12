import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { compileCodexPlugin, loadPersonality } from "@agentscience/personality";
import {
  getPackagedPersonalityArtifacts,
  installLinkedDirectory,
} from "./personality-package.mjs";

export const DEFAULT_CODEX_SKILL_NAME = "agentscience";
export const DEFAULT_CODEX_PLUGIN_NAME = "agent-science";
export const DEFAULT_CODEX_MARKETPLACE_NAME = "agentscience-local";
export const DEFAULT_CODEX_MARKETPLACE_DISPLAY_NAME = "AgentScience Local";

export function getCodexPaths({
  homeDir,
  cwd,
  pluginName = DEFAULT_CODEX_PLUGIN_NAME,
  skillName = DEFAULT_CODEX_SKILL_NAME,
}) {
  const resolvedHomeDir = homeDir || homedir();
  const resolvedCwd = cwd || process.cwd();
  const userSkillDir = `${resolvedHomeDir}/.agents/skills/${skillName}`;
  const projectSkillDir = `${resolvedCwd}/.agents/skills/${skillName}`;
  const userMarketplaceDir = `${resolvedHomeDir}/.agents/plugins`;
  const projectMarketplaceDir = `${resolvedCwd}/.agents/plugins`;
  const userPluginsDir = `${resolvedHomeDir}/plugins`;
  const projectPluginsDir = `${resolvedCwd}/plugins`;
  const userPluginDir = `${userPluginsDir}/${pluginName}`;
  const projectPluginDir = `${projectPluginsDir}/${pluginName}`;

  return {
    skillName,
    pluginName,
    userSkillsDir: `${resolvedHomeDir}/.agents/skills`,
    userSkillDir,
    userSkillPath: `${userSkillDir}/SKILL.md`,
    userMetadataPath: `${userSkillDir}/agents/openai.yaml`,
    userMarketplaceDir,
    userMarketplacePath: `${userMarketplaceDir}/marketplace.json`,
    userPluginsDir,
    userPluginDir,
    userPluginManifestPath: `${userPluginDir}/.codex-plugin/plugin.json`,
    projectSkillsDir: `${resolvedCwd}/.agents/skills`,
    projectSkillDir,
    projectSkillPath: `${projectSkillDir}/SKILL.md`,
    projectMetadataPath: `${projectSkillDir}/agents/openai.yaml`,
    projectMarketplaceDir,
    projectMarketplacePath: `${projectMarketplaceDir}/marketplace.json`,
    projectPluginsDir,
    projectPluginDir,
    projectPluginManifestPath: `${projectPluginDir}/.codex-plugin/plugin.json`,
  };
}

export function getCodexInstallTarget({ isProject = false, paths }) {
  const resolvedPaths = paths || getCodexPaths({});

  return isProject
    ? {
        scope: "project",
        pluginName: resolvedPaths.pluginName,
        marketplaceDir: resolvedPaths.projectMarketplaceDir,
        marketplacePath: resolvedPaths.projectMarketplacePath,
        pluginDir: resolvedPaths.projectPluginDir,
        pluginManifestPath: resolvedPaths.projectPluginManifestPath,
        legacySkillDir: resolvedPaths.projectSkillDir,
        legacySkillPath: resolvedPaths.projectSkillPath,
        legacyMetadataPath: resolvedPaths.projectMetadataPath,
      }
    : {
        scope: "user",
        pluginName: resolvedPaths.pluginName,
        marketplaceDir: resolvedPaths.userMarketplaceDir,
        marketplacePath: resolvedPaths.userMarketplacePath,
        pluginDir: resolvedPaths.userPluginDir,
        pluginManifestPath: resolvedPaths.userPluginManifestPath,
        legacySkillDir: resolvedPaths.userSkillDir,
        legacySkillPath: resolvedPaths.userSkillPath,
        legacyMetadataPath: resolvedPaths.userMetadataPath,
      };
}

export function buildCodexMarketplaceEntry({
  pluginName = DEFAULT_CODEX_PLUGIN_NAME,
  category = "Research",
} = {}) {
  return {
    name: pluginName,
    source: {
      source: "local",
      path: `./plugins/${pluginName}`,
    },
    policy: {
      installation: "AVAILABLE",
      authentication: "ON_INSTALL",
    },
    category,
  };
}

export function upsertCodexMarketplace(
  existingMarketplace,
  {
    pluginName = DEFAULT_CODEX_PLUGIN_NAME,
    marketplaceName = DEFAULT_CODEX_MARKETPLACE_NAME,
    marketplaceDisplayName = DEFAULT_CODEX_MARKETPLACE_DISPLAY_NAME,
    category = "Research",
  } = {}
) {
  const pluginEntry = buildCodexMarketplaceEntry({ pluginName, category });
  const marketplace =
    existingMarketplace && typeof existingMarketplace === "object" ? existingMarketplace : {};
  const plugins = Array.isArray(marketplace.plugins) ? [...marketplace.plugins] : [];
  const existingIndex = plugins.findIndex((plugin) => plugin?.name === pluginName);

  if (existingIndex >= 0) {
    plugins[existingIndex] = pluginEntry;
  } else {
    plugins.push(pluginEntry);
  }

  return {
    name:
      typeof marketplace.name === "string" && marketplace.name.trim()
        ? marketplace.name
        : marketplaceName,
    interface: {
      ...(marketplace.interface && typeof marketplace.interface === "object"
        ? marketplace.interface
        : {}),
      displayName:
        typeof marketplace.interface?.displayName === "string" &&
        marketplace.interface.displayName.trim()
          ? marketplace.interface.displayName
          : marketplaceDisplayName,
    },
    plugins,
  };
}

export function removeCodexMarketplacePlugin(
  existingMarketplace,
  { pluginName = DEFAULT_CODEX_PLUGIN_NAME } = {}
) {
  const marketplace =
    existingMarketplace && typeof existingMarketplace === "object" ? existingMarketplace : {};
  const plugins = Array.isArray(marketplace.plugins)
    ? marketplace.plugins.filter((plugin) => plugin?.name !== pluginName)
    : [];

  return {
    name:
      typeof marketplace.name === "string" && marketplace.name.trim()
        ? marketplace.name
        : DEFAULT_CODEX_MARKETPLACE_NAME,
    interface: {
      ...(marketplace.interface && typeof marketplace.interface === "object"
        ? marketplace.interface
        : {}),
      displayName:
        typeof marketplace.interface?.displayName === "string" &&
        marketplace.interface.displayName.trim()
          ? marketplace.interface.displayName
          : DEFAULT_CODEX_MARKETPLACE_DISPLAY_NAME,
    },
    plugins,
  };
}

function readJsonFile(jsonPath) {
  return JSON.parse(readFileSync(jsonPath, "utf8"));
}

function writeJsonFile(jsonPath, content) {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

function removePathIfPresent(targetPath) {
  if (!existsSync(targetPath)) {
    return false;
  }
  rmSync(targetPath, { recursive: true, force: true });
  return true;
}

function removeLegacyCodexSkill(target) {
  const removed = [];

  if (removePathIfPresent(target.legacySkillDir)) {
    removed.push(target.legacySkillDir);
  }

  return removed;
}

export function installCodexPlugin(
  { isProject = false, paths } = {}
) {
  const target = getCodexInstallTarget({ isProject, paths });
  const personality = loadPersonality();
  const compiledPlugin = compileCodexPlugin(personality);
  const packagedArtifacts = getPackagedPersonalityArtifacts();

  let installDetails;

  if (existsSync(packagedArtifacts.codexPluginDir)) {
    installDetails = installLinkedDirectory({
      sourceDir: packagedArtifacts.codexPluginDir,
      targetDir: target.pluginDir,
    });
  } else {
    mkdirSync(dirname(target.pluginDir), { recursive: true });
    removePathIfPresent(target.pluginDir);
    for (const [relativePath, contents] of Object.entries(compiledPlugin.files)) {
      const destination = join(target.pluginDir, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, contents);
    }
    installDetails = {
      installMode: "copied",
      sourcePath: null,
      autoUpdates: false,
    };
  }

  const marketplace = existsSync(target.marketplacePath)
    ? readJsonFile(target.marketplacePath)
    : undefined;
  writeJsonFile(
    target.marketplacePath,
    upsertCodexMarketplace(marketplace, {
      pluginName: compiledPlugin.marketplaceEntry.name,
      category: compiledPlugin.marketplaceEntry.category,
    })
  );

  return {
    ...target,
    pluginName: compiledPlugin.pluginName,
    legacySkillRemoved: removeLegacyCodexSkill(target),
    installMode: installDetails.installMode,
    autoUpdates: installDetails.autoUpdates,
    pluginSourcePath: installDetails.sourcePath,
    personalityVersion: personality.version,
    personalityContentHash: personality.contentHash,
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
