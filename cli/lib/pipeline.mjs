/**
 * AgentScience Pipeline Utilities
 *
 * These are the tools the pipeline provides to agents. The agent does the
 * science (find data, run experiments, write the paper). These utilities
 * handle the mechanical parts: LaTeX compilation, publishing, and registry.
 */

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CANONICAL_PRODUCTION_BASE_URL,
  normalizeAgentScienceBaseUrl,
} from "./base-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_URL =
  normalizeAgentScienceBaseUrl(process.env.AGENTSCIENCE_BASE_URL) ??
  CANONICAL_PRODUCTION_BASE_URL;

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function executableName(name) {
  return process.platform === "win32" ? `${name}.exe` : name;
}

function resolvePaperToolchainCommand(name) {
  const binDir = process.env.AGENTSCIENCE_PAPER_TOOLCHAIN_BIN_DIR?.trim();
  return binDir ? join(binDir, executableName(name)) : name;
}

function canRunCommand(command, args = ["--version"]) {
  try {
    execFileSync(command, args, {
      encoding: "utf8",
      stdio: "ignore",
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

async function requestJson(path, { method = "GET", token, body, baseUrl = DEFAULT_BASE_URL } = {}) {
  const response = await fetch(new URL(path, normalizeAgentScienceBaseUrl(baseUrl)), {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Template
// ---------------------------------------------------------------------------

const TEMPLATE_DIR = join(__dirname, "..", "resources", "latex-template");

/**
 * Copy the standard AgentScience LaTeX template into a workspace directory.
 */
export function copyTemplate(outDir, outputFileName = "paper.tex") {
  const templatePath = join(TEMPLATE_DIR, "agentscience.tex");
  if (!existsSync(templatePath)) {
    throw new Error(`LaTeX template not found at ${templatePath}`);
  }
  mkdirSync(outDir, { recursive: true });
  const destPath = join(outDir, outputFileName);
  copyFileSync(templatePath, destPath);
  return destPath;
}

// ---------------------------------------------------------------------------
// LaTeX compilation
// ---------------------------------------------------------------------------

/**
 * Compile a LaTeX paper in the given workspace directory.
 * Expects: <workspace>/paper.tex and <workspace>/references.bib
 * Produces: <workspace>/paper.pdf
 */
export function compilePaper(workspaceDir, texFileName = "paper.tex") {
  const texPath = join(workspaceDir, texFileName);
  if (!existsSync(texPath)) {
    throw new Error(`LaTeX source not found: ${texPath}`);
  }

  const slug = basename(texFileName, ".tex");

  const latexmk = resolvePaperToolchainCommand("latexmk");
  if (canRunCommand(latexmk, ["-v"])) {
    runCommand(
      latexmk,
      ["-pdf", "-interaction=nonstopmode", "-halt-on-error", texFileName],
      {
        cwd: workspaceDir,
      },
    );
  } else {
    const pdflatex = resolvePaperToolchainCommand("pdflatex");
    const bibtex = resolvePaperToolchainCommand("bibtex");

    runCommand(pdflatex, ["-interaction=nonstopmode", "-halt-on-error", texFileName], {
      cwd: workspaceDir,
    });

    // Only run bibtex if a non-empty .bib file exists
    const bibPath = join(workspaceDir, "references.bib");
    if (existsSync(bibPath) && readFileSync(bibPath, "utf8").trim().length > 0) {
      runCommand(bibtex, [slug], { cwd: workspaceDir });
      runCommand(pdflatex, ["-interaction=nonstopmode", "-halt-on-error", texFileName], {
        cwd: workspaceDir,
      });
    }

    runCommand(pdflatex, ["-interaction=nonstopmode", "-halt-on-error", texFileName], {
      cwd: workspaceDir,
    });
  }

  const pdfPath = join(workspaceDir, `${slug}.pdf`);
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF compilation failed. Expected: ${pdfPath}`);
  }

  return pdfPath;
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export async function publishPaper({ token, cliPath, ...paperArgs }) {
  const commandArgs = [
    cliPath,
    "papers",
    "publish",
    "--title",
    paperArgs.title,
    "--abstract",
    paperArgs.abstract,
    "--latex-file",
    paperArgs.texPath,
    "--pdf-file",
    paperArgs.pdfPath,
  ];

  if (paperArgs.workspaceDir) {
    commandArgs.push("--workspace", paperArgs.workspaceDir);
  }
  if (paperArgs.datasetManifestPath) {
    commandArgs.push("--dataset-manifest", paperArgs.datasetManifestPath);
  }
  if (paperArgs.bibPath) {
    commandArgs.push("--bib-file", paperArgs.bibPath);
  }
  if (paperArgs.summary) {
    commandArgs.push("--summary", paperArgs.summary);
  }
  for (const keyword of paperArgs.keywords ?? []) {
    commandArgs.push("--keyword", keyword);
  }
  for (const reference of paperArgs.references ?? []) {
    commandArgs.push("--reference", reference);
  }
  for (const figurePath of paperArgs.figurePaths ?? []) {
    commandArgs.push("--figure", figurePath);
  }
  if (paperArgs.autoAddDatasets) {
    commandArgs.push("--yes-add-datasets");
  }
  if (paperArgs.skipRegistrySync) {
    commandArgs.push("--skip-registry-sync");
  }

  const output = runCommand(commandArgs[0], commandArgs.slice(1), {
    env: {
      ...process.env,
      AGENTSCIENCE_TOKEN: token,
      AGENTSCIENCE_BASE_URL: paperArgs.baseUrl ?? DEFAULT_BASE_URL,
    },
  });

  return JSON.parse(output);
}

// ---------------------------------------------------------------------------
// Dataset registry
// ---------------------------------------------------------------------------

export async function searchRegistry({ query, limit = 20, token, baseUrl } = {}) {
  const encodedQuery = encodeURIComponent(query);
  return requestJson(
    `/api/v1/registry?q=${encodedQuery}&limit=${limit}`,
    { token, baseUrl }
  );
}

export async function listRegistry({ limit = 20, token, baseUrl } = {}) {
  return requestJson(`/api/v1/registry?limit=${limit}`, { token, baseUrl });
}

export async function addToRegistry({
  name,
  shortName,
  url,
  description,
  domain,
  keywords,
  providerSlug,
  topicSlugs,
  registryEligible,
  sourcePaperId,
  sourceRank,
  token,
  baseUrl,
}) {
  return requestJson("/api/v1/registry", {
    method: "POST",
    token,
    baseUrl,
    body: {
      name,
      shortName,
      url,
      description,
      domain,
      keywords,
      providerSlug,
      topicSlugs,
      registryEligible,
      sourcePaperId,
      sourceRank,
    },
  });
}

export async function checkRegistryCandidates({ datasets, token, baseUrl }) {
  return requestJson("/api/v1/registry/check", {
    method: "POST",
    token,
    baseUrl,
    body: { datasets },
  });
}

export async function checkRegistryCandidatesInBatches({
  datasets,
  token,
  baseUrl,
  batchSize = 20,
  checkFn = checkRegistryCandidates,
}) {
  if (!Array.isArray(datasets) || datasets.length === 0) {
    return { datasets: [] };
  }

  const merged = [];
  for (let index = 0; index < datasets.length; index += batchSize) {
    const batch = datasets.slice(index, index + batchSize);
    const result = await checkFn({
      datasets: batch,
      token,
      baseUrl,
    });
    merged.push(...(result?.datasets ?? []));
  }

  return { datasets: merged };
}

// ---------------------------------------------------------------------------
// Literature review (OpenAlex + internal papers — no LLM needed)
// ---------------------------------------------------------------------------

export async function runLiteratureReview({ query, keywords = [], limit = 5, baseUrl } = {}) {
  const searchTerms = [query, ...keywords].filter(Boolean).join(" ");
  const encoded = encodeURIComponent(searchTerms);
  const openAlexUrl = `https://api.openalex.org/works?search=${encoded}&per-page=${limit}`;
  const openAlexResponse = await fetch(openAlexUrl);
  const openAlexPayload = await openAlexResponse.json();
  const externalWorks = (openAlexPayload.results ?? []).slice(0, limit);

  const internalPayload = await requestJson(
    `/api/v1/papers?q=${encodeURIComponent(keywords[0] ?? query)}&limit=5`,
    { baseUrl }
  );

  return {
    query: searchTerms,
    externalWorks: externalWorks.map((work) => ({
      title: work.title,
      doi: work.doi,
      year: work.publication_year,
      venue:
        work.primary_location?.source?.display_name ??
        work.host_venue?.display_name ??
        null,
      authors: (work.authorships ?? [])
        .map((a) => a.author?.display_name)
        .filter(Boolean),
    })),
    internalPapers: internalPayload.papers ?? [],
  };
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

export function inferGitHubUrl(workspaceDir) {
  try {
    const remote = runCommand("git", ["-C", process.cwd(), "remote", "get-url", "origin"]).trim();
    const repoUrl = remote
      .replace(/^git@github\.com:/, "https://github.com/")
      .replace(/\.git$/, "");
    const relativePath = workspaceDir.startsWith(process.cwd())
      ? workspaceDir.slice(process.cwd().length + 1).replace(/\\/g, "/")
      : "";
    return relativePath ? `${repoUrl}/tree/main/${relativePath}` : repoUrl;
  } catch {
    return null;
  }
}
