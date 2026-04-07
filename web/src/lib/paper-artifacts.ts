import { basename, extname, posix } from "node:path";

import { PaperArtifactKind } from "@prisma/client";

const TEXT_EXTENSIONS = new Set([
  ".bib",
  ".c",
  ".cc",
  ".cpp",
  ".csv",
  ".h",
  ".hpp",
  ".ipynb",
  ".java",
  ".jl",
  ".js",
  ".json",
  ".md",
  ".py",
  ".r",
  ".rb",
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
  ".jl",
  ".js",
  ".py",
  ".r",
  ".rb",
  ".rs",
  ".sh",
  ".sql",
  ".ts",
  ".tsx",
]);

const DATA_EXTENSIONS = new Set([
  ".arrow",
  ".csv",
  ".feather",
  ".json",
  ".jsonl",
  ".ndjson",
  ".parquet",
  ".tsv",
  ".xlsx",
]);

export function normalizeArtifactPath(inputPath: string) {
  const normalized = inputPath.replace(/\\/g, "/").trim().replace(/^\/+/, "");
  const collapsed = posix.normalize(normalized);

  if (!collapsed || collapsed === "." || collapsed.startsWith("../")) {
    throw new Error("Artifact paths must stay within the workspace.");
  }

  return collapsed;
}

export function guessArtifactContentType(filePath: string) {
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

export function isTextLikeArtifact(filePath: string, contentType?: string | null) {
  if (contentType?.startsWith("text/")) {
    return true;
  }

  if (
    contentType === "application/json" ||
    contentType === "application/x-bibtex" ||
    contentType === "application/x-ipynb+json" ||
    contentType === "application/x-latex" ||
    contentType === "application/x-sh" ||
    contentType === "application/yaml"
  ) {
    return true;
  }

  return TEXT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function classifyArtifactKind(filePath: string) {
  const normalized = normalizeArtifactPath(filePath).toLowerCase();
  const extension = extname(normalized);
  const name = basename(normalized);

  if (extension === ".pdf") {
    return PaperArtifactKind.PDF;
  }

  if (extension === ".tex") {
    return PaperArtifactKind.LATEX_SOURCE;
  }

  if (extension === ".bib") {
    return PaperArtifactKind.BIBLIOGRAPHY;
  }

  if (
    name === "readme" ||
    name === "readme.md" ||
    name === "readme.txt" ||
    name.includes("experiment-log") ||
    name.includes("lab-notes")
  ) {
    return PaperArtifactKind.DOCUMENTATION;
  }

  if (normalized.startsWith("figures/") || normalized.startsWith("plots/")) {
    return ANALYSIS_EXTENSIONS.has(extension)
      ? PaperArtifactKind.FIGURE_CODE
      : PaperArtifactKind.OTHER;
  }

  if (
    normalized.startsWith("data/") ||
    normalized.startsWith("datasets/") ||
    normalized.startsWith("etl/") ||
    normalized.startsWith("scripts/etl/")
  ) {
    return ANALYSIS_EXTENSIONS.has(extension)
      ? PaperArtifactKind.DATA_PROCESSING_CODE
      : PaperArtifactKind.DATA;
  }

  if (ANALYSIS_EXTENSIONS.has(extension)) {
    return PaperArtifactKind.ANALYSIS_CODE;
  }

  if (DATA_EXTENSIONS.has(extension)) {
    return PaperArtifactKind.DATA;
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return PaperArtifactKind.DOCUMENTATION;
  }

  return PaperArtifactKind.OTHER;
}

export function artifactLanguageFromPath(filePath: string) {
  const extension = extname(filePath).toLowerCase();

  switch (extension) {
    case ".bib":
      return "bibtex";
    case ".c":
      return "c";
    case ".cc":
    case ".cpp":
    case ".h":
    case ".hpp":
      return "cpp";
    case ".csv":
      return "text";
    case ".ipynb":
    case ".json":
    case ".jsonl":
    case ".ndjson":
      return "json";
    case ".java":
      return "java";
    case ".jl":
      return "julia";
    case ".js":
      return "javascript";
    case ".md":
      return "markdown";
    case ".py":
      return "python";
    case ".r":
      return "r";
    case ".rb":
      return "ruby";
    case ".rs":
      return "rust";
    case ".sh":
      return "bash";
    case ".sql":
      return "sql";
    case ".tex":
      return "latex";
    case ".toml":
      return "toml";
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".yaml":
    case ".yml":
      return "yaml";
    default:
      return "text";
  }
}
