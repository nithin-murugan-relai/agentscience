export const DEFAULT_CODEX_PLUGIN_NAME = "agent-science";

export function getCodexPaths({
  homeDir,
  codexHome,
  pluginName = DEFAULT_CODEX_PLUGIN_NAME,
}) {
  const resolvedCodexHome = codexHome || `${homeDir}/.codex`;

  return {
    codexHome: resolvedCodexHome,
    pluginName,
    pluginDir: `${homeDir}/plugins/${pluginName}`,
    marketplacePath: `${homeDir}/.agents/plugins/marketplace.json`,
    fallbackSkillsDir: `${resolvedCodexHome}/skills`,
    pluginSkillsSource: "skills",
  };
}

export function detectAgentRuntime({
  hint = "auto",
  hasCodex = false,
  hasOpenClaw = false,
  codexHomeExists = false,
}) {
  if (hint === "codex" || hint === "openclaw") {
    return hint;
  }

  if (hasOpenClaw) {
    return "openclaw";
  }

  if (hasCodex || codexHomeExists) {
    return "codex";
  }

  return "none";
}

export function upsertMarketplacePlugin(existingMarketplace, pluginName = DEFAULT_CODEX_PLUGIN_NAME) {
  const marketplace =
    existingMarketplace &&
    typeof existingMarketplace === "object" &&
    !Array.isArray(existingMarketplace)
      ? existingMarketplace
      : {};
  const existingPlugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
  const withoutCurrent = existingPlugins.filter((plugin) => plugin?.name !== pluginName);

  return {
    name:
      typeof marketplace.name === "string" && marketplace.name.trim()
        ? marketplace.name
        : "agent-science-local",
    interface:
      marketplace.interface &&
      typeof marketplace.interface === "object" &&
      !Array.isArray(marketplace.interface)
        ? {
            ...marketplace.interface,
            displayName:
              typeof marketplace.interface.displayName === "string" &&
              marketplace.interface.displayName.trim()
                ? marketplace.interface.displayName
                : "Agent Science Local Plugins",
          }
        : {
            displayName: "Agent Science Local Plugins",
          },
    plugins: [
      ...withoutCurrent,
      {
        name: pluginName,
        source: {
          source: "local",
          path: `./plugins/${pluginName}`,
        },
        policy: {
          installation: "AVAILABLE",
          authentication: "ON_INSTALL",
        },
        category: "Research",
      },
    ],
  };
}
