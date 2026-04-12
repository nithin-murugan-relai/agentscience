import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, "..");
const artifactRoot = join(packageRoot, "dist", "artifacts");

const personalityModule = await import(pathToFileURL(join(packageRoot, "dist", "index.js")).href);

const personality = personalityModule.loadPersonality();
const codexPlugin = personalityModule.compileCodexPlugin(personality);
const claudeCommand = personalityModule.compileClaudeCodeSlashCommand(personality);

rmSync(artifactRoot, { recursive: true, force: true });

for (const [relativePath, contents] of Object.entries(codexPlugin.files)) {
  const destination = join(artifactRoot, "codex-plugin", relativePath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, contents);
}

const claudeDestination = join(artifactRoot, "claude-code", `${claudeCommand.commandName}.md`);
mkdirSync(dirname(claudeDestination), { recursive: true });
writeFileSync(claudeDestination, claudeCommand.content, "utf8");

writeFileSync(
  join(artifactRoot, "metadata.json"),
  `${JSON.stringify(
    {
      personalityVersion: personality.version,
      personalityContentHash: personality.contentHash,
      codexPluginDir: "codex-plugin",
      claudeCodeCommandPath: `claude-code/${claudeCommand.commandName}.md`,
    },
    null,
    2,
  )}\n`,
  "utf8",
);
