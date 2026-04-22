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

const OPEN_ARTIFACT_PATTERNS = [
  /\bsupplementary file(s)?\b/i,
  /\bseries matrix\b/i,
  /\bdownload family\b/i,
  /\braw\.(tar|zip|gz|bz2|xz)\b/i,
  /\bmatrix\b/i,
];

const OPEN_LICENSE_PATTERNS = [
  /\bpublic\b/i,
  /\bcc[-\s]?0\b/i,
  /\bcc[-\s]?by\b/i,
  /\bapache\b/i,
  /\bmit\b/i,
  /\bbsd\b/i,
  /\bgpl\b/i,
  /\bisc\b/i,
  /\bodc\b/i,
  /\bpddl\b/i,
  /\bcdla\b/i,
];

const RESTRICTIVE_LICENSE_PATTERNS = [
  /\ball rights reserved\b/i,
  /\bnon-?commercial\b/i,
  /\bno derivatives\b/i,
  /\bcc[-\s]?by[-\s]?nc\b/i,
  /\bcc[-\s]?by[-\s]?nd\b/i,
  /\brestricted\b/i,
  /\bproprietary\b/i,
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

function encodePathSegments(value) {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function normalizeLicenseValue(value) {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeLicenseValue(entry))
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(", ") : null;
  }

  if (typeof value === "string") {
    return normalizeWhitespace(value);
  }

  if (typeof value === "object") {
    return normalizeLicenseValue(
      value.id ??
        value.name ??
        value.title ??
        value.label ??
        null,
    );
  }

  return null;
}

function classifyLicenseValue(value) {
  const license = normalizeLicenseValue(value);
  if (!license) {
    return {
      license: null,
      licenseStatus: "unknown",
    };
  }

  if (RESTRICTIVE_LICENSE_PATTERNS.some((pattern) => pattern.test(license))) {
    return {
      license,
      licenseStatus: "restricted",
    };
  }

  if (OPEN_LICENSE_PATTERNS.some((pattern) => pattern.test(license))) {
    return {
      license,
      licenseStatus: "open",
    };
  }

  return {
    license,
    licenseStatus: "unknown",
  };
}

function extractOpenMlDatasetId(url) {
  try {
    const parsed = new URL(url);
    const directMatch = parsed.pathname.match(/^\/d\/(\d+)(?:\/)?$/i);
    if (directMatch?.[1]) {
      return directMatch[1];
    }
    return parsed.searchParams.get("id");
  } catch {
    return null;
  }
}

function extractHuggingFaceDatasetId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/datasets\/(.+?)(?:\/)?$/i);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function extractZenodoRecordId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/records\/(\d+)(?:\/)?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function extractCbioportalStudyId(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("id");
  } catch {
    return null;
  }
}

function extractFigshareArticleId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/articles\/dataset\/.+\/(\d+)(?:\/)?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchJson(url, { fetchImpl, headers = {} } = {}) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "application/json",
      "user-agent": "agentscience-cli-validation",
      ...headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Provider metadata request failed with HTTP ${response.status}.`);
  }

  return response.json();
}

function summarizeProviderMetadataValidation({
  status,
  summary,
  notes = [],
  apiLinks = [],
  directFileLinks = [],
  license = null,
  licenseStatus = "unknown",
  providerEvidence = [],
}) {
  return {
    status,
    summary,
    notes,
    apiLinks,
    directFileLinks,
    license,
    licenseStatus,
    providerEvidence,
  };
}

async function validateProviderMetadata(candidate, { fetchImpl = fetch } = {}) {
  const providerSlug = candidate.providerSlug ?? null;

  if (providerSlug === "openml") {
    const datasetId = extractOpenMlDatasetId(candidate.url);
    if (!datasetId) return null;
    const payload = await fetchJson(
      `https://www.openml.org/api/v1/json/data/${encodeURIComponent(datasetId)}`,
      { fetchImpl },
    );
    const description = payload?.data_set_description;
    const visibility = description?.visibility ?? null;
    const status = description?.status ?? null;
    const directFileLinks = uniqueStrings([description?.url, description?.parquet_url].filter(Boolean));
    const licenseInfo = classifyLicenseValue(description?.licence ?? description?.license ?? null);

    if (visibility === "public" && status === "active" && directFileLinks.length > 0 && licenseInfo.licenseStatus !== "restricted") {
      return summarizeProviderMetadataValidation({
        status: "OPEN_USABLE",
        summary: "OpenML metadata confirms the dataset is public with machine-readable download artifacts.",
        notes: [
          `OpenML format: ${description?.format ?? "unknown"}`,
          ...(licenseInfo.license ? [`OpenML license: ${licenseInfo.license}`] : []),
        ],
        directFileLinks,
        apiLinks: [`https://www.openml.org/api/v1/json/data/${datasetId}`],
        license: licenseInfo.license,
        licenseStatus: licenseInfo.licenseStatus,
        providerEvidence: [
          `visibility:${visibility}`,
          `status:${status}`,
          `files:${directFileLinks.length}`,
        ],
      });
    }

    return summarizeProviderMetadataValidation({
      status: "UNCLEAR",
      summary: "OpenML metadata did not confirm a fully open, reusable dataset artifact set.",
      notes: [
        ...(licenseInfo.license ? [`OpenML license: ${licenseInfo.license}`] : []),
      ],
      apiLinks: [`https://www.openml.org/api/v1/json/data/${datasetId}`],
      license: licenseInfo.license,
      licenseStatus: licenseInfo.licenseStatus,
      providerEvidence: [
        `visibility:${visibility ?? "unknown"}`,
        `status:${status ?? "unknown"}`,
      ],
    });
  }

  if (providerSlug === "huggingface-datasets") {
    const datasetId = extractHuggingFaceDatasetId(candidate.url);
    if (!datasetId) return null;
    const payload = await fetchJson(
      `https://huggingface.co/api/datasets/${encodePathSegments(datasetId)}`,
      { fetchImpl },
    );
    const licenseInfo = classifyLicenseValue(payload?.cardData?.license ?? payload?.tags?.filter?.((tag) => String(tag).startsWith("license:")).map((tag) => String(tag).replace(/^license:/, "")) ?? null);
    const gated = Boolean(payload?.gated);
    const isPrivate = Boolean(payload?.private);
    const disabled = Boolean(payload?.disabled);
    const siblings = Array.isArray(payload?.siblings) ? payload.siblings.length : 0;

    if (gated || isPrivate) {
      return summarizeProviderMetadataValidation({
        status: "ACCESS_CONTROLLED",
        summary: "Hugging Face marks this dataset as gated or private.",
        notes: [
          ...(licenseInfo.license ? [`Hugging Face license: ${licenseInfo.license}`] : []),
        ],
        apiLinks: [`https://huggingface.co/api/datasets/${encodePathSegments(datasetId)}`],
        license: licenseInfo.license,
        licenseStatus: licenseInfo.licenseStatus,
        providerEvidence: [
          `gated:${gated}`,
          `private:${isPrivate}`,
          `disabled:${disabled}`,
          `siblings:${siblings}`,
        ],
      });
    }

    if (!disabled && siblings > 0 && licenseInfo.licenseStatus === "open") {
      return summarizeProviderMetadataValidation({
        status: "OPEN_USABLE",
        summary: "Hugging Face metadata confirms a public dataset with repository files and an open license.",
        notes: [`Hugging Face license: ${licenseInfo.license}`],
        apiLinks: [`https://huggingface.co/api/datasets/${encodePathSegments(datasetId)}`],
        license: licenseInfo.license,
        licenseStatus: licenseInfo.licenseStatus,
        providerEvidence: [
          `siblings:${siblings}`,
          `downloads:${payload?.downloads ?? 0}`,
        ],
      });
    }

    return summarizeProviderMetadataValidation({
      status: "UNCLEAR",
      summary: "Hugging Face metadata did not confirm a clearly open-licensed reusable dataset.",
      notes: [
        ...(licenseInfo.license ? [`Hugging Face license: ${licenseInfo.license}`] : []),
      ],
      apiLinks: [`https://huggingface.co/api/datasets/${encodePathSegments(datasetId)}`],
      license: licenseInfo.license,
      licenseStatus: licenseInfo.licenseStatus,
      providerEvidence: [
        `gated:${gated}`,
        `private:${isPrivate}`,
        `disabled:${disabled}`,
        `siblings:${siblings}`,
      ],
    });
  }

  if (providerSlug === "zenodo") {
    const recordId = extractZenodoRecordId(candidate.url);
    if (!recordId) return null;
    const payload = await fetchJson(`https://zenodo.org/api/records/${encodeURIComponent(recordId)}`, {
      fetchImpl,
    });
    const files = Array.isArray(payload?.files) ? payload.files : [];
    const directFileLinks = uniqueStrings(
      files
        .map((file) => file?.links?.self ?? file?.links?.download ?? null)
        .filter(Boolean),
    );
    const accessRight = payload?.metadata?.access_right ?? payload?.access?.status ?? null;
    const licenseInfo = classifyLicenseValue(
      payload?.metadata?.license ??
        payload?.metadata?.rights?.[0] ??
        null,
    );

    if (accessRight === "open" && directFileLinks.length > 0 && licenseInfo.licenseStatus === "open") {
      return summarizeProviderMetadataValidation({
        status: "OPEN_USABLE",
        summary: "Zenodo metadata confirms open access files with an explicit open license.",
        notes: [`Zenodo license: ${licenseInfo.license}`],
        directFileLinks,
        apiLinks: [`https://zenodo.org/api/records/${recordId}`],
        license: licenseInfo.license,
        licenseStatus: licenseInfo.licenseStatus,
        providerEvidence: [
          `access:${accessRight}`,
          `files:${directFileLinks.length}`,
        ],
      });
    }

    return summarizeProviderMetadataValidation({
      status: accessRight && accessRight !== "open" ? "ACCESS_CONTROLLED" : "UNCLEAR",
      summary: "Zenodo metadata did not confirm openly reusable files with a clear open license.",
      notes: [
        ...(licenseInfo.license ? [`Zenodo license: ${licenseInfo.license}`] : []),
      ],
      apiLinks: [`https://zenodo.org/api/records/${recordId}`],
      license: licenseInfo.license,
      licenseStatus: licenseInfo.licenseStatus,
      providerEvidence: [
        `access:${accessRight ?? "unknown"}`,
        `files:${directFileLinks.length}`,
      ],
    });
  }

  if (providerSlug === "cbioportal") {
    const studyId = extractCbioportalStudyId(candidate.url);
    if (!studyId) return null;
    const payload = await fetchJson(
      `https://www.cbioportal.org/api/studies/${encodeURIComponent(studyId)}`,
      {
        fetchImpl,
        headers: { accept: "application/json" },
      },
    );
    const isPublicStudy = payload?.publicStudy === true || payload?.groups === "PUBLIC";
    const cohortSize =
      payload?.allSampleCount ??
      payload?.cnaSampleCount ??
      payload?.mrnaRnaSeqSampleCount ??
      payload?.sampleCount ??
      null;

    if (isPublicStudy) {
      return summarizeProviderMetadataValidation({
        status: "OPEN_USABLE",
        summary: "cBioPortal metadata confirms a public study page with open analysis-ready cancer genomics cohorts.",
        notes: [
          ...(payload?.name ? [`cBioPortal study: ${payload.name}`] : []),
        ],
        apiLinks: [`https://www.cbioportal.org/api/studies/${studyId}`],
        providerEvidence: [
          `groups:${payload?.groups ?? "unknown"}`,
          `publicStudy:${payload?.publicStudy === true}`,
          ...(cohortSize !== null ? [`samples:${cohortSize}`] : []),
        ],
      });
    }

    return summarizeProviderMetadataValidation({
      status: "ACCESS_CONTROLLED",
      summary: "cBioPortal metadata did not mark the study as public.",
      apiLinks: [`https://www.cbioportal.org/api/studies/${studyId}`],
      providerEvidence: [
        `groups:${payload?.groups ?? "unknown"}`,
        `publicStudy:${payload?.publicStudy === true}`,
      ],
    });
  }

  if (providerSlug === "figshare") {
    const articleId = extractFigshareArticleId(candidate.url);
    if (!articleId) return null;
    const payload = await fetchJson(`https://api.figshare.com/v2/articles/${encodeURIComponent(articleId)}`, {
      fetchImpl,
    });
    const files = Array.isArray(payload?.files) ? payload.files : [];
    const directFileLinks = uniqueStrings(files.map((file) => file?.download_url ?? null).filter(Boolean));
    const licenseInfo = classifyLicenseValue(payload?.license ?? null);

    if (payload?.is_public === true && directFileLinks.length > 0 && licenseInfo.licenseStatus === "open") {
      return summarizeProviderMetadataValidation({
        status: "OPEN_USABLE",
        summary: "figshare metadata confirms public files with an explicit open license.",
        notes: [`figshare license: ${licenseInfo.license}`],
        directFileLinks,
        apiLinks: [`https://api.figshare.com/v2/articles/${articleId}`],
        license: licenseInfo.license,
        licenseStatus: licenseInfo.licenseStatus,
        providerEvidence: [
          `public:${payload.is_public === true}`,
          `files:${directFileLinks.length}`,
        ],
      });
    }

    return summarizeProviderMetadataValidation({
      status: payload?.is_public === false ? "ACCESS_CONTROLLED" : "UNCLEAR",
      summary: "figshare metadata did not confirm openly reusable files with a clear open license.",
      notes: [
        ...(licenseInfo.license ? [`figshare license: ${licenseInfo.license}`] : []),
      ],
      apiLinks: [`https://api.figshare.com/v2/articles/${articleId}`],
      license: licenseInfo.license,
      licenseStatus: licenseInfo.licenseStatus,
      providerEvidence: [
        `public:${payload?.is_public === true}`,
        `files:${directFileLinks.length}`,
      ],
    });
  }

  return null;
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

  if (evidence.apiLinks.length > 0 && evidence.artifactSignals.length > 0) {
    return {
      status: "OPEN_USABLE",
      summary: "The page exposes downloadable dataset artifacts that look openly usable for analysis.",
    };
  }

  if (
    evidence.providerHint === "sdss" &&
    evidence.apiLinks.length > 0 &&
    /(bulk download|science archive server|sas|catalog archive server|casjobs)/i.test(evidence.pageText)
  ) {
    return {
      status: "OPEN_USABLE",
      summary: "The SDSS data-release page exposes open archive and bulk download entry points.",
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
      artifactSignals: [],
      directFileLinks: [],
      githubDataLinks: [],
      apiLinks: [],
      providerEvidence: [],
      license: null,
      licenseStatus: "unknown",
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
  let artifactSignals = [];
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
      artifactSignals = collectPatternMatches(pageText, OPEN_ARTIFACT_PATTERNS);
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
    providerHint,
    title,
    directFileLike,
    accessSignals,
    datasetSignals,
    artifactSignals,
    directFileLinks,
    githubDataLinks,
    apiLinks,
  };

  let providerMetadata = null;
  try {
    providerMetadata = await validateProviderMetadata(candidate, { fetchImpl });
  } catch (error) {
    providerMetadata = {
      status: null,
      summary: null,
      notes: [
        `Provider metadata lookup failed: ${error instanceof Error ? error.message : "Unknown error."}`,
      ],
      directFileLinks: [],
      apiLinks: [],
      license: null,
      licenseStatus: "unknown",
      providerEvidence: [],
    };
  }

  const classification =
    providerMetadata?.status && providerMetadata.status !== "UNCLEAR"
      ? {
          status: providerMetadata.status,
          summary: providerMetadata.summary,
        }
      : classifyValidationEvidence(evidence);
  const notes = [];
  if (hintNote) {
    notes.push(hintNote);
  }
  if (providerMetadata?.notes?.length) {
    notes.push(...providerMetadata.notes);
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
    artifactSignals,
    directFileLinks: uniqueStrings([
      ...directFileLinks,
      ...(providerMetadata?.directFileLinks ?? []),
    ]).slice(0, 10),
    githubDataLinks,
    apiLinks: uniqueStrings([
      ...apiLinks,
      ...(providerMetadata?.apiLinks ?? []),
    ]).slice(0, 10),
    providerEvidence: providerMetadata?.providerEvidence ?? [],
    license: providerMetadata?.license ?? null,
    licenseStatus: providerMetadata?.licenseStatus ?? "unknown",
    notes,
    ...classification,
  };
}

export function validationPassesWithoutOverride(report) {
  return report.status === "OPEN_USABLE";
}

export function formatDatasetValidationLines(report) {
  const artifactSignals = report.artifactSignals ?? [];
  const providerEvidence = report.providerEvidence ?? [];
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
  if (providerEvidence.length > 0) {
    lines.push(`Provider evidence: ${providerEvidence.join(", ")}`);
  }
  if (report.license) {
    lines.push(`License: ${report.license} (${report.licenseStatus})`);
  }
  if (artifactSignals.length > 0) {
    lines.push(`Artifact signals: ${artifactSignals.join(", ")}`);
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
