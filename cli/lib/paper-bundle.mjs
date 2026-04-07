import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";

const FIGURE_EXTENSIONS = new Set([".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const TEXT_EXTENSIONS = new Set([
  ".bib",
  ".csv",
  ".ipynb",
  ".js",
  ".json",
  ".jsonl",
  ".md",
  ".ndjson",
  ".py",
  ".r",
  ".rs",
  ".sh",
  ".sql",
  ".tex",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const ANALYSIS_EXTENSIONS = new Set([
  ".ipynb",
  ".js",
  ".py",
  ".r",
  ".rs",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
]);
const DATA_EXTENSIONS = new Set([".csv", ".json", ".jsonl", ".ndjson", ".parquet", ".tsv"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".next",
  ".venv",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "venv",
]);
const EXCLUDED_SUFFIXES = [
  ".aux",
  ".fdb_latexmk",
  ".fls",
  ".log",
  ".out",
  ".pyc",
  ".synctex.gz",
  ".toc",
];

export function normalizeBundlePath(inputPath) {
  const normalized = inputPath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!normalized || normalized === "." || normalized.startsWith("../")) {
    throw new Error("Artifact paths must stay inside the workspace.");
  }
  return normalized;
}

export function guessBundleContentType(filePath) {
  const extension = extname(filePath).toLowerCase();

  switch (extension) {
    case ".bib":
      return "application/x-bibtex";
    case ".csv":
      return "text/csv";
    case ".ipynb":
      return "application/x-ipynb+json";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".json":
    case ".jsonl":
    case ".ndjson":
      return "application/json";
    case ".md":
      return "text/markdown";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".r":
      return "text/x-rsrc";
    case ".sh":
      return "application/x-sh";
    case ".svg":
      return "image/svg+xml";
    case ".tex":
      return "application/x-latex";
    case ".toml":
      return "application/toml";
    case ".ts":
      return "application/typescript";
    case ".tsx":
      return "text/tsx";
    case ".txt":
      return "text/plain";
    case ".webp":
      return "image/webp";
    case ".yaml":
    case ".yml":
      return "application/yaml";
    default:
      if (TEXT_EXTENSIONS.has(extension)) {
        return "text/plain";
      }
      return "application/octet-stream";
  }
}

export function classifyBundleArtifactKind(filePath) {
  const normalized = normalizeBundlePath(filePath).toLowerCase();
  const extension = extname(normalized);
  const name = basename(normalized);

  if (extension === ".pdf") {
    return "PDF";
  }

  if (extension === ".tex") {
    return "LATEX_SOURCE";
  }

  if (extension === ".bib") {
    return "BIBLIOGRAPHY";
  }

  if (
    name === "readme" ||
    name === "readme.md" ||
    name === "readme.txt" ||
    name.includes("experiment-log") ||
    name.includes("lab-notes")
  ) {
    return "DOCUMENTATION";
  }

  if (normalized.startsWith("figures/") || normalized.startsWith("plots/")) {
    return ANALYSIS_EXTENSIONS.has(extension) ? "FIGURE_CODE" : "OTHER";
  }

  if (
    normalized.startsWith("data/") ||
    normalized.startsWith("datasets/") ||
    normalized.startsWith("etl/") ||
    normalized.startsWith("scripts/etl/")
  ) {
    return ANALYSIS_EXTENSIONS.has(extension) ? "DATA_PROCESSING_CODE" : "DATA";
  }

  if (ANALYSIS_EXTENSIONS.has(extension)) {
    return "ANALYSIS_CODE";
  }

  if (DATA_EXTENSIONS.has(extension)) {
    return "DATA";
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return "DOCUMENTATION";
  }

  return "OTHER";
}

export function isFigureFile(filePath) {
  return FIGURE_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function shouldSkipWorkspacePath(relativePath) {
  if (!relativePath || relativePath.startsWith("../")) {
    return true;
  }

  if (relativePath.split("/").some((segment) => EXCLUDED_DIRECTORIES.has(segment))) {
    return true;
  }

  return EXCLUDED_SUFFIXES.some((suffix) => relativePath.endsWith(suffix));
}

function walkWorkspace(currentDir, workspaceDir, files) {
  for (const entry of readdirSync(currentDir)) {
    const absolutePath = join(currentDir, entry);
    const relativePath = relative(workspaceDir, absolutePath).replace(/\\/g, "/");

    if (shouldSkipWorkspacePath(relativePath)) {
      continue;
    }

    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      walkWorkspace(absolutePath, workspaceDir, files);
      continue;
    }

    files.push({
      absolutePath,
      relativePath: normalizeBundlePath(relativePath),
    });
  }
}

export function collectWorkspaceBundle({
  workspaceDir,
  figurePaths = [],
}) {
  const resolvedWorkspace = resolve(workspaceDir);
  const files = [];
  const figureByPath = new Map();

  walkWorkspace(resolvedWorkspace, resolvedWorkspace, files);

  for (const figurePath of figurePaths) {
    const absolutePath = resolve(figurePath);
    figureByPath.set(absolutePath, {
      absolutePath,
      fileName: basename(absolutePath),
      contentType: guessBundleContentType(absolutePath),
    });
  }

  const artifactEntries = [];

  for (const file of files) {
    const contentType = guessBundleContentType(file.relativePath);

    if (isFigureFile(file.relativePath)) {
      figureByPath.set(file.absolutePath, {
        absolutePath: file.absolutePath,
        fileName: basename(file.absolutePath),
        contentType,
      });
      continue;
    }

    if (contentType === "application/octet-stream") {
      continue;
    }

    artifactEntries.push({
      absolutePath: file.absolutePath,
      path: file.relativePath,
      contentType,
      kind: classifyBundleArtifactKind(file.relativePath),
    });
  }

  return {
    workspaceDir: resolvedWorkspace,
    artifacts: artifactEntries.map((entry, index) => ({
      fieldName: `artifact_${index}`,
      path: entry.path,
      contentType: entry.contentType,
      kind: entry.kind,
      file: new File([readFileSync(entry.absolutePath)], basename(entry.absolutePath), {
        type: entry.contentType,
      }),
    })),
    figures: [...figureByPath.values()],
  };
}
