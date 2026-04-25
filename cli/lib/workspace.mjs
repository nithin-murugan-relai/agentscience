import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { copyFigureHelper, copyTemplate } from "./pipeline.mjs";

const DEFAULT_WORKSPACE_DIRNAME = "agentscience-papers";
const SLUG_MAX_LENGTH = 60;

function resolveUserPath(inputPath) {
  if (!inputPath) {
    return join(homedir(), DEFAULT_WORKSPACE_DIRNAME);
  }
  if (inputPath === "~") {
    return homedir();
  }
  if (inputPath.startsWith("~/")) {
    return join(homedir(), inputPath.slice(2));
  }
  return resolve(inputPath);
}

function createEmptyFile(filePath) {
  writeFileSync(filePath, "", { flag: "wx" });
}

function isPaperWorkspaceDir(entry) {
  return entry.isDirectory() && !entry.name.startsWith(".");
}

function looksLikePaperWorkspace(directoryPath) {
  return (
    existsSync(join(directoryPath, "paper.tex")) ||
    existsSync(join(directoryPath, ".venv"))
  );
}

export function getWorkspaceBase(config = {}) {
  return resolveUserPath(config.workspaceBase);
}

export function slugify(idea) {
  const normalized = String(idea ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");

  return slug || "paper";
}

export function initPaperWorkspace(idea, config = {}) {
  const workspaceBase = getWorkspaceBase(config);
  const slug = slugify(idea);
  const paperDir = join(workspaceBase, slug);

  if (existsSync(paperDir)) {
    throw new Error(`Paper workspace already exists: ${paperDir}`);
  }

  try {
    mkdirSync(join(paperDir, "code"), { recursive: true });
    mkdirSync(join(paperDir, "data", "raw"), { recursive: true });
    mkdirSync(join(paperDir, "data", "processed"), { recursive: true });
    mkdirSync(join(paperDir, "figures"), { recursive: true });

    createEmptyFile(join(paperDir, "requirements.txt"));
    createEmptyFile(join(paperDir, "references.bib"));
    createEmptyFile(join(paperDir, "experiment-log.md"));
    createEmptyFile(join(paperDir, "figure-descriptions.md"));
    createEmptyFile(join(paperDir, "abstract.txt"));
    copyTemplate(paperDir, "paper.tex", {
      authorName: config.authorName,
      authorAffiliation: config.authorAffiliation,
    });
    copyFigureHelper(join(paperDir, "code"));

    execFileSync("python3", ["-m", "venv", ".venv"], {
      cwd: paperDir,
      stdio: "pipe",
    });
  } catch (error) {
    rmSync(paperDir, { recursive: true, force: true });
    throw error;
  }

  return paperDir;
}

export function listPaperWorkspaces(config = {}) {
  const workspaceBase = getWorkspaceBase(config);

  if (!existsSync(workspaceBase)) {
    return [];
  }

  return readdirSync(workspaceBase, { withFileTypes: true })
    .filter(isPaperWorkspaceDir)
    .map((entry) => join(workspaceBase, entry.name))
    .filter(looksLikePaperWorkspace)
    .map((entry) => {
      const paperDir = entry;
      const stats = statSync(paperDir);
      return {
        slug: basename(paperDir),
        path: paperDir,
        createdAt: stats.birthtime.toISOString(),
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
