import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { getCodexInstallTarget, getCodexPaths } from "./codex.mjs";
import {
  isSymbolicLink,
  parsePersonalityMetadata,
} from "./personality-package.mjs";

const UPDATE_CACHE_FILENAME = "update-check.json";
const UPDATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const NPM_LATEST_URL = "https://registry.npmjs.org/agentscience/latest";

export function compareSemver(left, right) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta < 0 ? -1 : 1;
    }
  }

  return 0;
}

function readJsonFile(filePath, fallback = null) {
  if (!existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, content) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
}

function buildUpdateCachePath(homeDir = homedir()) {
  return join(homeDir, ".config", "agentscience", UPDATE_CACHE_FILENAME);
}

export function getClaudeCodePaths({ homeDir = homedir(), cwd = process.cwd() } = {}) {
  return {
    userCommandPath: join(homeDir, ".claude", "commands", "agentscience.md"),
    projectCommandPath: join(cwd, ".claude", "commands", "agentscience.md"),
  };
}

function readInstalledMetadata(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return parsePersonalityMetadata(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function buildSurfaceStatus({
  surface,
  scope,
  installPath,
  metadataPath,
  currentPersonalityVersion,
  currentPersonalityContentHash,
}) {
  const installed = existsSync(installPath);
  const metadata = readInstalledMetadata(metadataPath);
  const linked = installed ? isSymbolicLink(installPath) : false;
  const current =
    metadata?.personalityVersion === currentPersonalityVersion &&
    metadata?.personalityContentHash === currentPersonalityContentHash;

  return {
    surface,
    scope,
    installed,
    installPath,
    installMode: installed ? (linked ? "linked" : "copied") : "missing",
    autoUpdates: installed ? linked : false,
    personalityVersion: metadata?.personalityVersion ?? null,
    personalityContentHash: metadata?.personalityContentHash ?? null,
    refreshRecommended: installed ? !current : false,
    current,
  };
}

function pickActiveSurface(projectSurface, userSurface) {
  if (projectSurface.installed) {
    return projectSurface;
  }
  return userSurface;
}

export function readInstalledRuntimeSurfaces({
  cwd = process.cwd(),
  homeDir = homedir(),
  currentPersonalityVersion,
  currentPersonalityContentHash,
} = {}) {
  const codexPaths = getCodexPaths({ cwd, homeDir });
  const codexUserTarget = getCodexInstallTarget({ paths: codexPaths });
  const codexProjectTarget = getCodexInstallTarget({ isProject: true, paths: codexPaths });
  const claudePaths = getClaudeCodePaths({ cwd, homeDir });

  const codex = {
    user: buildSurfaceStatus({
      surface: "codex",
      scope: "user",
      installPath: codexUserTarget.pluginDir,
      metadataPath: join(codexUserTarget.pluginDir, "skills", "agentscience", "SKILL.md"),
      currentPersonalityVersion,
      currentPersonalityContentHash,
    }),
    project: buildSurfaceStatus({
      surface: "codex",
      scope: "project",
      installPath: codexProjectTarget.pluginDir,
      metadataPath: join(codexProjectTarget.pluginDir, "skills", "agentscience", "SKILL.md"),
      currentPersonalityVersion,
      currentPersonalityContentHash,
    }),
  };
  codex.active = pickActiveSurface(codex.project, codex.user);

  const claudeCode = {
    user: buildSurfaceStatus({
      surface: "claude-code",
      scope: "user",
      installPath: claudePaths.userCommandPath,
      metadataPath: claudePaths.userCommandPath,
      currentPersonalityVersion,
      currentPersonalityContentHash,
    }),
    project: buildSurfaceStatus({
      surface: "claude-code",
      scope: "project",
      installPath: claudePaths.projectCommandPath,
      metadataPath: claudePaths.projectCommandPath,
      currentPersonalityVersion,
      currentPersonalityContentHash,
    }),
  };
  claudeCode.active = pickActiveSurface(claudeCode.project, claudeCode.user);

  return {
    codex,
    claudeCode,
  };
}

export async function checkForCliUpdate({
  currentVersion,
  homeDir = homedir(),
  fetchImpl = fetch,
  now = Date.now(),
  forceRefresh = false,
} = {}) {
  const cachePath = buildUpdateCachePath(homeDir);
  const cached = readJsonFile(cachePath);
  const freshEnough =
    cached?.checkedAt && now - Date.parse(cached.checkedAt) < UPDATE_CACHE_TTL_MS;

  if (!forceRefresh && freshEnough) {
    return {
      latestVersion: cached.latestVersion ?? null,
      checkedAt: cached.checkedAt,
      source: "cache",
      updateAvailable:
        typeof cached.latestVersion === "string" &&
        compareSemver(currentVersion, cached.latestVersion) < 0,
    };
  }

  try {
    const response = await fetchImpl(NPM_LATEST_URL, {
      signal: AbortSignal.timeout?.(1500),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Registry request failed with status ${response.status}`);
    }
    const payload = await response.json();
    const latestVersion = typeof payload?.version === "string" ? payload.version : null;
    const checkedAt = new Date(now).toISOString();

    writeJsonFile(cachePath, { latestVersion, checkedAt });

    return {
      latestVersion,
      checkedAt,
      source: "network",
      updateAvailable:
        typeof latestVersion === "string" && compareSemver(currentVersion, latestVersion) < 0,
    };
  } catch (error) {
    return {
      latestVersion: cached?.latestVersion ?? null,
      checkedAt: cached?.checkedAt ?? null,
      source: cached ? "cache-stale" : "unavailable",
      updateAvailable:
        typeof cached?.latestVersion === "string" &&
        compareSemver(currentVersion, cached.latestVersion) < 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function buildRuntimeStatus({
  currentVersion,
  currentPersonalityVersion,
  currentPersonalityContentHash,
  cwd = process.cwd(),
  homeDir = homedir(),
  fetchImpl = fetch,
  forceRefresh = false,
} = {}) {
  const update = await checkForCliUpdate({
    currentVersion,
    homeDir,
    fetchImpl,
    forceRefresh,
  });
  const surfaces = readInstalledRuntimeSurfaces({
    cwd,
    homeDir,
    currentPersonalityVersion,
    currentPersonalityContentHash,
  });

  const nextSteps = [];
  if (update.updateAvailable) {
    nextSteps.push("npm install -g agentscience@latest");
  }
  if (surfaces.codex.active.refreshRecommended) {
    nextSteps.push(
      surfaces.codex.active.scope === "project"
        ? "agentscience setup codex --project"
        : "agentscience setup codex",
    );
  }
  if (surfaces.claudeCode.active.refreshRecommended) {
    nextSteps.push(
      surfaces.claudeCode.active.scope === "project"
        ? "agentscience setup claude-code --project"
        : "agentscience setup claude-code",
    );
  }

  return {
    ok: true,
    updateAvailable: update.updateAvailable,
    cli: {
      version: currentVersion,
      personalityVersion: currentPersonalityVersion,
      personalityContentHash: currentPersonalityContentHash,
      latestVersion: update.latestVersion,
      checkedAt: update.checkedAt,
      checkSource: update.source,
    },
    codex: surfaces.codex,
    claudeCode: surfaces.claudeCode,
    nextSteps,
  };
}

export function formatRuntimeAttention(status) {
  const messages = [];

  if (status.updateAvailable) {
    messages.push(
      `A newer AgentScience CLI is available (${status.cli.latestVersion}). Update with: npm install -g agentscience@latest`,
    );
  }

  if (status.codex.active.refreshRecommended) {
    messages.push(
      `Your active Codex AgentScience install is stale. Refresh it with: ${
        status.codex.active.scope === "project"
          ? "agentscience setup codex --project"
          : "agentscience setup codex"
      }`,
    );
  }

  if (status.claudeCode.active.refreshRecommended) {
    messages.push(
      `Your active Claude Code AgentScience install is stale. Refresh it with: ${
        status.claudeCode.active.scope === "project"
          ? "agentscience setup claude-code --project"
          : "agentscience setup claude-code"
      }`,
    );
  }

  return messages;
}
