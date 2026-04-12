import { cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

export const PERSONALITY_METADATA_PATTERN =
  /<!-- AgentScience personality version: ([^;]+); hash: ([0-9a-f]+) -->/i;

function removePathIfPresent(targetPath) {
  if (!existsSync(targetPath)) {
    return false;
  }
  rmSync(targetPath, { recursive: true, force: true });
  return true;
}

export function parsePersonalityMetadata(content) {
  const match = content.match(PERSONALITY_METADATA_PATTERN);
  if (!match) {
    return null;
  }

  return {
    personalityVersion: match[1],
    personalityContentHash: match[2],
  };
}

export function resolvePersonalityPackageRoot() {
  const entryPath = require.resolve("@agentscience/personality");
  return dirname(dirname(entryPath));
}

export function getPackagedPersonalityArtifacts() {
  const packageRoot = resolvePersonalityPackageRoot();
  const artifactRoot = join(packageRoot, "dist", "artifacts");

  return {
    packageRoot,
    artifactRoot,
    codexPluginDir: join(artifactRoot, "codex-plugin"),
    claudeCodeCommandPath: join(artifactRoot, "claude-code", "agentscience.md"),
    metadataPath: join(artifactRoot, "metadata.json"),
  };
}

export function isSymbolicLink(targetPath) {
  if (!existsSync(targetPath)) {
    return false;
  }

  return lstatSync(targetPath).isSymbolicLink();
}

export function installLinkedDirectory({ sourceDir, targetDir }) {
  mkdirSync(dirname(targetDir), { recursive: true });
  removePathIfPresent(targetDir);

  try {
    symlinkSync(sourceDir, targetDir, process.platform === "win32" ? "junction" : "dir");
    return {
      installMode: "linked",
      sourcePath: sourceDir,
      autoUpdates: true,
    };
  } catch (error) {
    cpSync(sourceDir, targetDir, { recursive: true });
    return {
      installMode: "copied",
      sourcePath: sourceDir,
      autoUpdates: false,
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}

export function installLinkedFile({ sourcePath, targetPath }) {
  mkdirSync(dirname(targetPath), { recursive: true });
  removePathIfPresent(targetPath);

  try {
    symlinkSync(sourcePath, targetPath, "file");
    return {
      installMode: "linked",
      sourcePath,
      autoUpdates: true,
    };
  } catch (error) {
    cpSync(sourcePath, targetPath);
    return {
      installMode: "copied",
      sourcePath,
      autoUpdates: false,
      fallbackReason: error instanceof Error ? error.message : String(error),
    };
  }
}
