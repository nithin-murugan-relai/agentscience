import type { SidekickReferenceInput } from "@/lib/sidekick/validation";
import { chunkArray } from "@/lib/utils";

interface FetchJsonOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  headers?: HeadersInit;
}

interface SemanticScholarPaperResult {
  paperId?: string;
  title?: string;
  abstract?: string | null;
}

interface CrossrefWorkResult {
  DOI?: string;
  title?: string[];
}

const semanticScholarWindow = {
  limit: 95,
  windowMs: 5 * 60 * 1000,
  timestamps: [] as number[],
};

let crossrefNextAllowedAt = 0;

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForSemanticScholarSlot(sleep = defaultSleep) {
  const now = Date.now();
  semanticScholarWindow.timestamps = semanticScholarWindow.timestamps.filter(
    (timestamp) => now - timestamp < semanticScholarWindow.windowMs
  );

  if (semanticScholarWindow.timestamps.length < semanticScholarWindow.limit) {
    semanticScholarWindow.timestamps.push(now);
    return;
  }

  const earliest = semanticScholarWindow.timestamps[0] ?? now;
  const waitMs = semanticScholarWindow.windowMs - (now - earliest) + 50;
  await sleep(waitMs);
  return waitForSemanticScholarSlot(sleep);
}

async function waitForCrossrefSlot(sleep = defaultSleep) {
  const now = Date.now();
  if (now < crossrefNextAllowedAt) {
    await sleep(crossrefNextAllowedAt - now);
  }

  crossrefNextAllowedAt = Date.now() + 1100;
}

async function fetchJsonWithRetry<T>(
  url: string,
  options: FetchJsonOptions = {},
  attempt = 0
): Promise<T | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/json",
      ...options.headers,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (response.status === 429 && attempt < 4) {
    const retryAfterSeconds = Number(response.headers.get("retry-after") || "0");
    const backoffMs =
      retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Math.min(10_000, 400 * 2 ** attempt);
    await sleep(backoffMs);
    return fetchJsonWithRetry(url, options, attempt + 1);
  }

  if (!response.ok) {
    if (attempt < 2 && response.status >= 500) {
      await sleep(250 * 2 ** attempt);
      return fetchJsonWithRetry(url, options, attempt + 1);
    }

    throw new Error(`External API request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function normalizeDoi(doi: string | null | undefined) {
  return doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() || null;
}

export async function lookupSemanticScholarByDoi(
  doi: string,
  options: FetchJsonOptions = {}
) {
  await waitForSemanticScholarSlot(options.sleep);
  const normalizedDoi = normalizeDoi(doi);
  if (!normalizedDoi) {
    return null;
  }

  return fetchJsonWithRetry<SemanticScholarPaperResult>(
    `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(
      normalizedDoi
    )}?fields=paperId,title,abstract`,
    options
  );
}

export async function lookupSemanticScholarByTitle(
  title: string,
  options: FetchJsonOptions = {}
) {
  await waitForSemanticScholarSlot(options.sleep);
  const result = await fetchJsonWithRetry<{ data?: SemanticScholarPaperResult[] }>(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(
      title
    )}&limit=1&fields=paperId,title,abstract`,
    options
  );

  return result?.data?.[0] ?? null;
}

export async function lookupCrossrefByTitle(
  title: string,
  mailto: string,
  options: FetchJsonOptions = {}
) {
  await waitForCrossrefSlot(options.sleep);
  const result = await fetchJsonWithRetry<{
    message?: { items?: CrossrefWorkResult[] };
  }>(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(
      title
    )}&rows=1&mailto=${encodeURIComponent(mailto)}`,
    options
  );

  return result?.message?.items?.[0] ?? null;
}

export async function validateReferenceExists(
  reference: SidekickReferenceInput,
  mailto: string,
  options: FetchJsonOptions = {}
) {
  if (reference.doi) {
    const byDoi = await lookupSemanticScholarByDoi(reference.doi, options);
    if (byDoi?.paperId || byDoi?.title) {
      return true;
    }
  }

  const byTitle = await lookupSemanticScholarByTitle(reference.title, options);
  if (byTitle?.paperId || byTitle?.title) {
    return true;
  }

  const crossref = await lookupCrossrefByTitle(reference.title, mailto, options);
  return Boolean(crossref?.DOI || crossref?.title?.[0]);
}

export async function validateReferencesBatch(
  references: SidekickReferenceInput[],
  mailto: string,
  options: FetchJsonOptions = {}
) {
  const results: boolean[] = [];

  for (const chunk of chunkArray(references, 5)) {
    for (const reference of chunk) {
      results.push(await validateReferenceExists(reference, mailto, options));
    }
  }

  const validatedCount = results.filter(Boolean).length;
  return {
    validated: results,
    rate: references.length > 0 ? validatedCount / references.length : 0,
  };
}

export async function fetchReferenceAbstractSamples(
  references: Array<{ title: string; doi?: string | null; validated?: boolean }>,
  options: FetchJsonOptions = {}
) {
  const eligible = references.filter((reference) => reference.validated !== false);
  const selected = eligible.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const abstracts: string[] = [];

  for (const reference of selected) {
    const byDoi = reference.doi
      ? await lookupSemanticScholarByDoi(reference.doi, options)
      : null;
    const resolved = byDoi ?? (await lookupSemanticScholarByTitle(reference.title, options));
    if (resolved?.title || resolved?.abstract) {
      abstracts.push(
        [
          `Title: ${resolved.title || reference.title}`,
          `Abstract: ${resolved.abstract || "No abstract available."}`,
        ].join("\n")
      );
    }
  }

  return abstracts;
}
