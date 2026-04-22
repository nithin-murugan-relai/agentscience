const DIRECT_FILE_EXTENSIONS = [
  ".csv",
  ".tsv",
  ".json",
  ".jsonl",
  ".ndjson",
  ".parquet",
  ".zip",
  ".gz",
  ".bz2",
  ".xz",
  ".tar",
  ".tgz",
  ".feather",
  ".arrow",
  ".h5",
  ".hdf5",
  ".npy",
  ".npz",
  ".xlsx",
  ".xls",
  ".txt",
];

const DIRECT_FILE_CONTENT_TYPES = [
  "application/json",
  "application/zip",
  "application/gzip",
  "application/x-gzip",
  "application/x-zip-compressed",
  "application/vnd.apache.parquet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
  "text/csv",
  "text/tab-separated-values",
  "text/plain",
];

const ACCESS_CONTROLLED_PATTERNS = [
  /sign in/i,
  /log in/i,
  /login/i,
  /create account/i,
  /requires? (an )?account/i,
  /request access/i,
  /controlled access/i,
  /dbgap/i,
  /data use agreement/i,
  /\bdua\b/i,
  /apply for access/i,
  /access must be requested/i,
  /approval required/i,
  /credentialed access/i,
  /authentication required/i,
  /paywall/i,
  /subscribe to access/i,
];

const DATASET_SIGNAL_PATTERNS = [
  /\bdataset\b/i,
  /\bdownload\b/i,
  /\bfile(s)?\b/i,
  /\bapi\b/i,
  /\bmanifest\b/i,
  /\bdata portal\b/i,
  /\baccess data\b/i,
  /\brepository\b/i,
];

const GITHUB_DATA_PATH_PATTERNS = [
  /\/tree\/[^/]+\/(?:data|dataset|datasets)(?:\/|$)/i,
  /\/blob\/[^/]+\/.+\.(csv|tsv|json|jsonl|ndjson|parquet|zip|gz|xlsx?|txt)$/i,
];

const PROVIDER_ACCESS_HINTS = new Map([
  ["kaggle.com", "Kaggle datasets typically require Kaggle credentials or browser auth."],
  ["gdc.cancer.gov", "GDC datasets often mix open metadata with controlled-access files."],
  ["physionet.org", "PhysioNet datasets often require credentialed access or DUA acceptance."],
]);

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function lowerHost(value) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function looksLikeDirectDataFile(url, contentType = "") {
  const loweredUrl = url.toLowerCase();
  if (DIRECT_FILE_EXTENSIONS.some((extension) => loweredUrl.endsWith(extension))) {
    return true;
  }
  const normalizedContentType = contentType.toLowerCase();
  return DIRECT_FILE_CONTENT_TYPES.some((value) => normalizedContentType.includes(value));
}

function stripHtml(html) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalizeWhitespace(match[1]) : null;
}

function collectLinks(html, baseUrl) {
  const links = [];
  const hrefPattern = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(hrefPattern)) {
    const href = match[2];
    const label = normalizeWhitespace(stripHtml(match[3] ?? ""));
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) {
      continue;
    }

    try {
      const resolved = new URL(href, baseUrl).toString();
      links.push({
        url: resolved,
        label,
      });
    } catch {
      // Ignore malformed links.
    }
  }

  return links;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectPatternMatches(text, patterns) {
  return uniqueStrings(
    patterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.source),
  );
}

function summarizeConcreteAccessLinks(links, baseUrl) {
  const baseHost = lowerHost(baseUrl);
  const directFileLinks = [];
  const githubDataLinks = [];
  const apiLinks = [];

  for (const link of links) {
    if (looksLikeDirectDataFile(link.url)) {
      directFileLinks.push(link.url);
      continue;
    }

    if (link.url.includes("/api/") || /\bdownload\b/i.test(link.label) || /\bdownload\b/i.test(link.url)) {
      apiLinks.push(link.url);
    }

    if (
      baseHost === "github.com" &&
      GITHUB_DATA_PATH_PATTERNS.some((pattern) => pattern.test(link.url))
    ) {
      githubDataLinks.push(link.url);
    }
  }

  return {
    directFileLinks: uniqueStrings(directFileLinks).slice(0, 10),
    githubDataLinks: uniqueStrings(githubDataLinks).slice(0, 10),
    apiLinks: uniqueStrings(apiLinks).slice(0, 10),
  };
}

function classifyValidationEvidence(evidence) {
  if (evidence.networkError) {
    return {
      status: "BROKEN",
      summary: "The dataset URL could not be fetched.",
    };
  }

  if ([401, 403].includes(evidence.httpStatus ?? 0)) {
    return {
      status: "ACCESS_CONTROLLED",
      summary: "The dataset URL returned an authorization error.",
    };
  }

  if ((evidence.httpStatus ?? 0) >= 400) {
    return {
      status: "BROKEN",
      summary: `The dataset URL returned HTTP ${evidence.httpStatus}.`,
    };
  }

  if (evidence.directFileLike) {
    return {
      status: "OPEN_USABLE",
      summary: "The URL appears to point directly to an openly accessible data file.",
    };
  }

  if (
    evidence.accessSignals.length > 0 &&
    evidence.directFileLinks.length === 0 &&
    evidence.githubDataLinks.length === 0 &&
    evidence.apiLinks.length === 0
  ) {
    return {
      status: "ACCESS_CONTROLLED",
      summary: "The page shows authentication or controlled-access signals without open data artifacts.",
    };
  }

  if (
    evidence.directFileLinks.length > 0 ||
    evidence.githubDataLinks.length > 0 ||
    evidence.apiLinks.length >= 2
  ) {
    return {
      status: "OPEN_USABLE",
      summary: "The page exposes concrete file or API links that look usable for analysis.",
    };
  }

  if (
    evidence.datasetSignals.length > 0 &&
    (evidence.apiLinks.length > 0 || evidence.pageText.includes("download") || evidence.pageText.includes("access data"))
  ) {
    return {
      status: "INDEX_ONLY",
      summary: "The page looks like a dataset landing page, but it does not expose enough concrete open artifacts yet.",
    };
  }

  return {
    status: "UNCLEAR",
    summary: "The page did not provide enough concrete evidence to prove the dataset is openly usable.",
  };
}

export async function validateDatasetCandidate(candidate, { fetchImpl = fetch } = {}) {
  const checkedAt = new Date().toISOString();
  const providerHint = candidate.providerSlug ?? null;
  const hostHint = lowerHost(candidate.url);
  const hintNote = PROVIDER_ACCESS_HINTS.get(hostHint) ?? null;

  let response;
  try {
    response = await fetchImpl(candidate.url, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/json,text/plain,*/*",
      },
    });
  } catch (error) {
    return {
      checkedAt,
      inputUrl: candidate.url,
      finalUrl: candidate.url,
      providerHint,
      hostHint,
      networkError: error instanceof Error ? error.message : "Unknown network error.",
      httpStatus: null,
      contentType: null,
      contentLength: null,
      title: null,
      directFileLike: false,
      accessSignals: [],
      datasetSignals: [],
      directFileLinks: [],
      githubDataLinks: [],
      apiLinks: [],
      notes: hintNote ? [hintNote] : [],
      ...classifyValidationEvidence({
        networkError: true,
      }),
    };
  }

  const finalUrl = response.url || candidate.url;
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  const directFileLike = looksLikeDirectDataFile(finalUrl, contentType ?? "");

  let title = null;
  let pageText = "";
  let accessSignals = [];
  let datasetSignals = [];
  let directFileLinks = [];
  let githubDataLinks = [];
  let apiLinks = [];

  if (!directFileLike && response.ok) {
    try {
      const html = await response.text();
      title = extractTitle(html);
      pageText = stripHtml(html).toLowerCase().slice(0, 60000);
      accessSignals = collectPatternMatches(pageText, ACCESS_CONTROLLED_PATTERNS);
      datasetSignals = collectPatternMatches(pageText, DATASET_SIGNAL_PATTERNS);
      const summarizedLinks = summarizeConcreteAccessLinks(collectLinks(html, finalUrl), finalUrl);
      directFileLinks = summarizedLinks.directFileLinks;
      githubDataLinks = summarizedLinks.githubDataLinks;
      apiLinks = summarizedLinks.apiLinks;
    } catch {
      // Best effort only.
    }
  }

  const evidence = {
    networkError: null,
    httpStatus: response.status,
    contentType,
    contentLength,
    pageText,
    title,
    directFileLike,
    accessSignals,
    datasetSignals,
    directFileLinks,
    githubDataLinks,
    apiLinks,
  };

  const classification = classifyValidationEvidence(evidence);
  const notes = [];
  if (hintNote) {
    notes.push(hintNote);
  }
  if (candidate.description) {
    notes.push(`Claimed use: ${candidate.description}`);
  }

  return {
    checkedAt,
    inputUrl: candidate.url,
    finalUrl,
    providerHint,
    hostHint,
    networkError: null,
    httpStatus: response.status,
    contentType,
    contentLength: contentLength ? Number(contentLength) : null,
    title,
    directFileLike,
    accessSignals,
    datasetSignals,
    directFileLinks,
    githubDataLinks,
    apiLinks,
    notes,
    ...classification,
  };
}

export function validationPassesWithoutOverride(report) {
  return report.status === "OPEN_USABLE";
}

export function formatDatasetValidationLines(report) {
  const lines = [
    `Validation status: ${report.status}`,
    `Summary: ${report.summary}`,
    `Final URL: ${report.finalUrl}`,
  ];

  if (report.httpStatus !== null) {
    lines.push(`HTTP status: ${report.httpStatus}`);
  }
  if (report.title) {
    lines.push(`Page title: ${report.title}`);
  }
  if (report.contentType) {
    lines.push(`Content-Type: ${report.contentType}`);
  }
  if (report.directFileLinks.length > 0) {
    lines.push(`Concrete file links: ${report.directFileLinks.length}`);
  }
  if (report.githubDataLinks.length > 0) {
    lines.push(`GitHub data paths: ${report.githubDataLinks.length}`);
  }
  if (report.apiLinks.length > 0) {
    lines.push(`API/download links: ${report.apiLinks.length}`);
  }
  if (report.accessSignals.length > 0) {
    lines.push(`Access signals: ${report.accessSignals.join(", ")}`);
  }
  if (report.notes.length > 0) {
    for (const note of report.notes) {
      lines.push(`Note: ${note}`);
    }
  }

  return lines;
}
