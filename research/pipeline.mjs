import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_URL =
  process.env.SIDEKICK_SOCIAL_BASE_URL ?? "https://agentscience.vercel.app";
const OPENCLAW_SESSION_TARGET =
  process.env.OPENCLAW_RESEARCH_SESSION ?? "+15550001111";

function runCommand(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 72);
}

async function requestJson(path, { method = "GET", token, body } = {}) {
  const response = await fetch(new URL(path, DEFAULT_BASE_URL), {
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
    return "https://github.com/vineet-reddy/sidekick-social";
  }
}

function extractOpenClawText(rawOutput) {
  const parsed = JSON.parse(rawOutput);
  return parsed.result?.payloads?.map((payload) => payload.text).join("\n").trim() ?? "";
}

export function callOpenClawJson(prompt) {
  const rawOutput = runCommand("bash", [
    "-ilc",
    `openclaw agent --to ${OPENCLAW_SESSION_TARGET} --message ${shellQuote(prompt)} --thinking off --json`,
  ]);
  const text = extractOpenClawText(rawOutput);
  return JSON.parse(text);
}

export async function getProfileContext({ handle = "me", token }) {
  if (handle === "me") {
    return requestJson("/api/v1/me", { token });
  }
  const payload = await requestJson(`/api/v1/profiles/${handle}`);
  return payload.profile;
}

export async function suggestIdeas({ handle = "me", token, context = "", count = 3 }) {
  const profile = await getProfileContext({ handle, token });
  const prompt = `You are helping generate proactive scientific research ideas.
Return JSON only with shape {"ideas":[{"title":"string","summary":"string","keywords":["kw"]}]}.
Use the researcher's interests, institution, and bio. Keep it specific, plausible, and experimentally testable.
Researcher profile:
${JSON.stringify(profile, null, 2)}
Extra context:
${context || "none"}
Generate exactly ${count} ideas.`;

  return {
    profile,
    ...(callOpenClawJson(prompt)),
  };
}

export async function buildResearchPlan({ idea, handle = "me", token }) {
  const profile = await getProfileContext({ handle, token });
  const prompt = `Create a scientific research plan from the idea below.
Return JSON only with shape {"title":"string","hypothesis":"string","methodology":["step"],"experiments":["experiment"],"deliverables":["deliverable"],"keywords":["kw"]}.
Researcher profile:
${JSON.stringify(profile, null, 2)}
Idea:
${idea}`;

  const plan = callOpenClawJson(prompt);
  return { profile, plan };
}

function toBibtexKey(index, item) {
  const author = item.authorships?.[0]?.author?.display_name ?? "citation";
  const year = item.publication_year ?? "2024";
  return `${slugify(author).replace(/-/g, "") || "citation"}${year}${index}`;
}

function toBibtexEntry(index, item) {
  const key = toBibtexKey(index, item);
  const authors = (item.authorships ?? [])
    .map((authorship) => authorship.author?.display_name)
    .filter(Boolean)
    .join(" and ");
  const venue =
    item.primary_location?.source?.display_name ??
    item.host_venue?.display_name ??
    "OpenAlex";
  const doi = item.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? "";
  return `@article{${key},
  title = {${item.title?.replace(/[{}]/g, "") ?? "Untitled"}},
  author = {${authors || "Unknown"}},
  journal = {${venue.replace(/[{}]/g, "")}},
  year = {${item.publication_year ?? "2024"}},
  doi = {${doi}}
}`;
}

export async function runLiteratureReview({ idea, keywords = [], limit = 5 }) {
  const query = encodeURIComponent([idea, ...keywords].filter(Boolean).join(" "));
  const openAlexUrl = `https://api.openalex.org/works?search=${query}&per-page=${limit}`;
  const openAlexResponse = await fetch(openAlexUrl);
  const openAlexPayload = await openAlexResponse.json();
  const externalWorks = (openAlexPayload.results ?? []).slice(0, limit);

  const internalPayload = await requestJson(
    `/api/v1/papers?q=${encodeURIComponent(keywords[0] ?? idea)}&limit=5`
  );

  return {
    query,
    externalWorks: externalWorks.map((work, index) => ({
      title: work.title,
      doi: work.doi,
      year: work.publication_year,
      venue:
        work.primary_location?.source?.display_name ??
        work.host_venue?.display_name ??
        null,
      authors: (work.authorships ?? [])
        .map((authorship) => authorship.author?.display_name)
        .filter(Boolean),
      bibtex: toBibtexEntry(index + 1, work),
    })),
    internalPapers: internalPayload.papers ?? [],
  };
}

function generateSyntheticSeries(seedText, count = 8) {
  const seed = Array.from(seedText).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const baseline = 0.75 + (seed % 13) * 0.01;
    const slope = 0.11 + ((seed + index) % 5) * 0.02;
    const seasonal = Math.sin((index + 1) * 0.8) * 0.06;
    values.push({
      x: index + 1,
      y: Number((baseline + slope * index + seasonal).toFixed(3)),
    });
  }
  return values;
}

function writeCsv(path, rows) {
  const header = "x,y\n";
  const body = rows.map((row) => `${row.x},${row.y}`).join("\n");
  writeFileSync(path, `${header}${body}\n`);
}

function composeLatex({ title, abstract, plan, literature, figureFile, narrativeSections }) {
  const bibliographyKeys = literature.externalWorks
    .map((work, index) => toBibtexKey(index + 1, {
      authorships: work.authors.map((name) => ({ author: { display_name: name } })),
      publication_year: work.year,
      title: work.title,
    }))
    .slice(0, 3);

  return `\\documentclass[11pt]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage[numbers]{natbib}
\\title{${title.replace(/[{}]/g, "")}}
\\author{Sidekick Social Research Pipeline}
\\date{}
\\begin{document}
\\maketitle
\\begin{abstract}
${abstract}
\\end{abstract}
\\section{Introduction}
${narrativeSections.introduction}

\\section{Methodology}
${narrativeSections.methodology}

\\section{Results}
${narrativeSections.results}

\\begin{figure}[h]
  \\centering
  \\includegraphics[width=0.8\\linewidth]{${figureFile}}
  \\caption{Synthetic experiment trace generated from the pipeline output.}
\\end{figure}

\\section{Discussion}
${narrativeSections.discussion}

\\section{Conclusion}
${narrativeSections.conclusion}

\\bibliographystyle{plainnat}
\\bibliography{references}
\\end{document}
`;
}

function generateNarrativeSections({ idea, plan, literature }) {
  const externalTitles = literature.externalWorks.slice(0, 3).map((work) => work.title);
  return {
    introduction: `This paper investigates ${idea.toLowerCase()} in the context of ${plan.keywords.join(", ")}. Prior work including ${externalTitles.join("; ")} motivates a focused empirical test of the stated hypothesis.`,
    methodology: `We translate the research plan into an executable workflow with four stages: ${plan.methodology.join("; ")}. A reproducible local analysis script generates the synthetic response curve reported here and the complete source bundle is attached through the linked GitHub repository.`,
    results: `The pipeline-generated experiment produces a monotonic improvement trend across the simulated condition index. This is not intended as a clinical claim; it demonstrates that the Sidekick Social pipeline can generate structured analyses, figures, and publication-ready assets from an approved idea.`,
    discussion: `The approach emphasizes agent usability and reproducibility. Internal Sidekick Social papers were reviewed alongside external literature, and the generated bibliography can be expanded or replaced with domain-specific sources for a full downstream study.`,
    conclusion: `The result is a complete LaTeX-first research artifact that can be inspected, revised, and published through the Sidekick Social CLI and API.`,
  };
}

export async function buildPaperBundle({
  idea,
  workspaceDir,
  githubUrl,
  handle = "me",
  token,
}) {
  const { plan } = await buildResearchPlan({ idea, handle, token });
  const literature = await runLiteratureReview({
    idea,
    keywords: plan.keywords ?? [],
    limit: 5,
  });

  const slug = slugify(plan.title || idea);
  const workDir = resolve(workspaceDir);
  ensureDir(workDir);
  ensureDir(join(workDir, "figures"));
  ensureDir(join(workDir, "data"));

  const dataRows = generateSyntheticSeries(idea);
  const csvPath = join(workDir, "data", "results.csv");
  writeCsv(csvPath, dataRows);

  const figurePath = join(workDir, "figures", "figure-1.png");
  runCommand("python3", [
    join(__dirname, "generate_figure.py"),
    csvPath,
    figurePath,
    plan.title,
  ]);

  const abstract = `${plan.hypothesis} This paper bundle was generated by the Sidekick Social overnight research pipeline and is intended as a reproducible draft for expert review.`;
  const narrativeSections = generateNarrativeSections({ idea, plan, literature });
  const bibSource = `${literature.externalWorks.map((work) => work.bibtex).join("\n\n")}\n`;
  const latexSource = composeLatex({
    title: plan.title,
    abstract,
    plan,
    literature,
    figureFile: "figures/figure-1.png",
    narrativeSections,
  });

  const texPath = join(workDir, `${slug}.tex`);
  const bibPath = join(workDir, "references.bib");
  writeFileSync(texPath, latexSource);
  writeFileSync(bibPath, bibSource);

  runCommand("pdflatex", ["-interaction=nonstopmode", basename(texPath)], { cwd: workDir });
  runCommand("bibtex", [slug], { cwd: workDir });
  runCommand("pdflatex", ["-interaction=nonstopmode", basename(texPath)], { cwd: workDir });
  runCommand("pdflatex", ["-interaction=nonstopmode", basename(texPath)], { cwd: workDir });

  const pdfPath = join(workDir, `${slug}.pdf`);
  if (!existsSync(pdfPath)) {
    throw new Error("Expected compiled PDF was not produced.");
  }

  const metadata = {
    slug,
    title: plan.title,
    abstract,
    keywords: plan.keywords ?? [],
    references: literature.externalWorks
      .map((work) => work.doi || work.title)
      .filter(Boolean),
    githubUrl: githubUrl || inferGitHubUrl(workDir),
    summary: `Research plan: ${plan.hypothesis}\n\nMethodology:\n- ${plan.methodology.join("\n- ")}`,
    files: {
      texPath,
      bibPath,
      pdfPath,
      figurePaths: [figurePath],
      csvPath,
    },
    plan,
    literature,
  };

  writeFileSync(join(workDir, "pipeline-output.json"), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

export async function publishPaperBundle({ bundle, token, cliPath }) {
  const commandArgs = [
    cliPath,
    "papers",
    "publish",
    "--title",
    bundle.title,
    "--abstract",
    bundle.abstract,
    "--summary",
    bundle.summary,
    "--latex-file",
    bundle.files.texPath,
    "--pdf-file",
    bundle.files.pdfPath,
    "--bib-file",
    bundle.files.bibPath,
    "--github-url",
    bundle.githubUrl,
  ];

  for (const keyword of bundle.keywords) {
    commandArgs.push("--keyword", keyword);
  }
  for (const reference of bundle.references) {
    commandArgs.push("--reference", reference);
  }
  for (const figurePath of bundle.files.figurePaths) {
    commandArgs.push("--figure", figurePath);
  }

  const output = runCommand(commandArgs[0], commandArgs.slice(1), {
    env: {
      ...process.env,
      SIDEKICK_SOCIAL_TOKEN: token,
      SIDEKICK_SOCIAL_BASE_URL: DEFAULT_BASE_URL,
    },
  });

  return JSON.parse(output);
}
