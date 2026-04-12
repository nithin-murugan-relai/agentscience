const DEFAULT_DESKTOP_RELEASE_REPOSITORY = "vineet-reddy/agentscience-app";
const GITHUB_ORIGIN = "https://github.com";

type DesktopPlatform = "mac" | "linux" | "win";
type DesktopArch = "arm64" | "x64";

export function getDesktopReleaseRepository() {
  const configuredRepository = process.env.AGENTSCIENCE_DESKTOP_RELEASE_REPOSITORY?.trim();
  if (!configuredRepository) {
    return DEFAULT_DESKTOP_RELEASE_REPOSITORY;
  }

  const [owner, repo, ...rest] = configuredRepository.split("/");
  if (!owner || !repo || rest.length > 0) {
    return DEFAULT_DESKTOP_RELEASE_REPOSITORY;
  }

  return `${owner}/${repo}`;
}

export function getDesktopReleasePageUrl() {
  return `${GITHUB_ORIGIN}/${getDesktopReleaseRepository()}/releases`;
}

function getStableAssetName(platform: DesktopPlatform, arch: DesktopArch) {
  if (platform === "mac" && arch === "arm64") {
    return "Agent-Science-mac-arm64.dmg";
  }

  if (platform === "mac" && arch === "x64") {
    return "Agent-Science-mac-intel.dmg";
  }

  if (platform === "linux" && arch === "x64") {
    return "Agent-Science-linux-x64.AppImage";
  }

  if (platform === "win" && arch === "x64") {
    return "Agent-Science-windows-x64.exe";
  }

  return null;
}

export function getLatestDesktopDownloadUrl(platform: DesktopPlatform, arch: DesktopArch) {
  const assetName = getStableAssetName(platform, arch);
  if (!assetName) {
    return getDesktopReleasePageUrl();
  }

  return `${GITHUB_ORIGIN}/${getDesktopReleaseRepository()}/releases/latest/download/${assetName}`;
}
