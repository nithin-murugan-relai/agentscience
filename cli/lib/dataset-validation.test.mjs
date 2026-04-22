import assert from "node:assert/strict";
import test from "node:test";

import {
  formatDatasetValidationLines,
  validateDatasetCandidate,
  validationPassesWithoutOverride,
} from "./dataset-validation.mjs";

test("validateDatasetCandidate accepts direct open data files", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://example.org/data.csv",
      description: "CSV with pediatric cohort measurements.",
      providerSlug: null,
    },
    {
      fetchImpl: async () =>
        new Response("id,value\n1,2\n", {
          status: 200,
          headers: { "content-type": "text/csv" },
        }),
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.equal(validationPassesWithoutOverride(report), true);
});

test("validateDatasetCandidate flags auth-walled pages as access controlled", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://example.org/private-dataset",
      description: "Dataset behind a sign-in wall.",
      providerSlug: null,
    },
    {
      fetchImpl: async () =>
        new Response("<html><title>Sign in</title><body>Sign in to request access</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    },
  );

  assert.equal(report.status, "ACCESS_CONTROLLED");
  assert.equal(validationPassesWithoutOverride(report), false);
});

test("validateDatasetCandidate accepts GitHub repos with visible data artifacts", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://github.com/example/pediatric-cancer-data",
      description: "Repository with data and metadata files.",
      providerSlug: "github",
    },
    {
      fetchImpl: async () =>
        new Response(
          `
            <html>
              <title>example/pediatric-cancer-data</title>
              <body>
                <a href="/example/pediatric-cancer-data/tree/main/data">data</a>
                <a href="/example/pediatric-cancer-data/blob/main/data/train.csv">train.csv</a>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.ok(report.githubDataLinks.length > 0);
});

test("validateDatasetCandidate treats pages with concrete download links as usable even if navigation mentions login", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://example.org/dataset-portal",
      description: "Portal with direct download links.",
      providerSlug: null,
    },
    {
      fetchImpl: async () =>
        new Response(
          `
            <html>
              <title>Dataset Portal</title>
              <body>
                Login
                <a href="/download/data.csv">Download CSV</a>
                <a href="/api/files/metadata.json">API metadata</a>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
});

test("validateDatasetCandidate marks thin landing pages as index-only", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://example.org/study",
      description: "Study landing page.",
      providerSlug: null,
    },
    {
      fetchImpl: async () =>
        new Response(
          `
            <html>
              <title>Pediatric Cancer Study</title>
              <body>
                Dataset overview. Access data and tools.
              </body>
            </html>
          `,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        ),
    },
  );

  assert.equal(report.status, "INDEX_ONLY");
  assert.equal(validationPassesWithoutOverride(report), false);
});

test("formatDatasetValidationLines produces a readable summary", () => {
  const lines = formatDatasetValidationLines({
    status: "OPEN_USABLE",
    summary: "Looks good.",
    finalUrl: "https://example.org/data.csv",
    httpStatus: 200,
    title: null,
    contentType: "text/csv",
    directFileLinks: [],
    githubDataLinks: [],
    apiLinks: [],
    accessSignals: [],
    notes: ["Claimed use: test dataset"],
  });

  assert.ok(lines.some((line) => line.includes("Validation status: OPEN_USABLE")));
  assert.ok(lines.some((line) => line.includes("Claimed use: test dataset")));
});
