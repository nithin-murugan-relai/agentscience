function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeDatasetUrl(value) {
  const parsed = new URL(value.trim());

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url must use http or https.");
  }

  parsed.hash = "";

  if ((parsed.protocol === "http:" && parsed.port === "80") || (parsed.protocol === "https:" && parsed.port === "443")) {
    parsed.port = "";
  }

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

function normalizeDatasetDomainFromUrl(value) {
  return new URL(normalizeDatasetUrl(value)).hostname.replace(/^www\./i, "");
}

function normalizeUrlForProviderComparison(value, providerDomain) {
  const parsed = new URL(normalizeDatasetUrl(value));
  parsed.hostname = providerDomain;
  return parsed.toString();
}

export function isCanonicalRegistryProvider(provider) {
  return Boolean(
    provider?.searchKind &&
      provider.searchEndpoint &&
      provider.searchQueryTemplate &&
      provider.datasetUrlTemplate &&
      provider.agentInstructions,
  );
}

export function extractProviderDatasetIdentifiers(template, datasetUrl, providerDomain) {
  const tokenizedTemplate = template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_, token) => {
    return `__TOKEN_${token}__`;
  });
  const normalizedTemplate = normalizeUrlForProviderComparison(tokenizedTemplate, providerDomain);
  const normalizedDatasetUrl = normalizeUrlForProviderComparison(datasetUrl, providerDomain);
  const patternSource = escapeRegex(normalizedTemplate).replace(
    /__TOKEN_([A-Za-z0-9_]+)__/g,
    (_, token) => `(?<${token}>.+?)`,
  );
  const match = new RegExp(`^${patternSource}$`, "i").exec(normalizedDatasetUrl);
  if (!match?.groups) {
    return null;
  }

  const identifiers = Object.fromEntries(
    Object.entries(match.groups)
      .map(([key, value]) => [key, decodeURIComponent(value)])
      .filter(([, value]) => typeof value === "string" && value.trim().length > 0),
  );

  return Object.keys(identifiers).length > 0 ? identifiers : null;
}

export function evaluateStandaloneRegistryPolicy({
  candidate,
  provider,
  knownTopicSlugs,
}) {
  if (candidate.sourcePaperId) {
    return {
      ok: true,
      mode: "paper-backed",
      errors: [],
      identifiers: null,
    };
  }

  const errors = [];
  let identifiers = null;

  if (!candidate.providerSlug) {
    errors.push(
      "Standalone dataset registry adds require --provider-slug and it must reference a canonical provider.",
    );
  } else if (!provider) {
    errors.push(
      `Unknown providerSlug '${candidate.providerSlug}'. Use a canonical dataset provider slug from the provider catalog.`,
    );
  } else {
    if (!isCanonicalRegistryProvider(provider)) {
      errors.push(
        `Provider '${provider.slug}' is not a canonical dataset provider yet, so standalone registry adds are blocked for it.`,
      );
    }

    if (normalizeDatasetDomainFromUrl(candidate.url) !== provider.domain) {
      errors.push(
        `Dataset URL domain does not match the canonical provider domain '${provider.domain}'.`,
      );
    }

    if (provider.datasetUrlTemplate) {
      identifiers = extractProviderDatasetIdentifiers(
        provider.datasetUrlTemplate,
        candidate.url,
        provider.domain,
      );
      if (!identifiers) {
        errors.push(
          `Dataset URL does not match provider '${provider.slug}' URL template '${provider.datasetUrlTemplate}'. Use a canonical dataset page URL, not an ad hoc export or query result.`,
        );
      }
    }
  }

  if (!candidate.topicSlugs || candidate.topicSlugs.length === 0) {
    errors.push("Standalone dataset registry adds require at least one explicit --topic-slug.");
  } else if (knownTopicSlugs) {
    const unknownTopicSlugs = candidate.topicSlugs.filter((slug) => !knownTopicSlugs.has(slug));
    if (unknownTopicSlugs.length > 0) {
      errors.push(`Unknown topic slug(s): ${unknownTopicSlugs.join(", ")}.`);
    }
  }

  return {
    ok: errors.length === 0,
    mode: "standalone",
    errors,
    identifiers: errors.length === 0 ? identifiers : null,
  };
}

export function formatStandaloneRegistryPolicyLines(policy) {
  if (policy.mode === "paper-backed") {
    return ["Standalone policy: bypassed because sourcePaperId is present."];
  }

  if (policy.ok) {
    return ["Standalone policy: PASS"];
  }

  return [
    "Standalone policy: FAIL",
    ...policy.errors.map((error) => `Policy error: ${error}`),
  ];
}
