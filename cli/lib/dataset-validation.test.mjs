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

test("validateDatasetCandidate accepts GEO series pages with downloadable artifacts", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=GSE77286",
      description: "Arabidopsis zinc supply transcriptomics series.",
      providerSlug: "geo",
    },
    {
      fetchImpl: async () =>
        new Response(
          `
            <html>
              <title>GEO Accession viewer</title>
              <body>
                Not logged in | Login
                <strong>Series GSE77286</strong>
                Samples (42)
                <table>
                  <tr><td>Download family</td></tr>
                  <tr><td>Series Matrix File(s)</td></tr>
                  <tr><td>Supplementary file</td></tr>
                  <tr><td>GSE77286_RAW.tar</td></tr>
                </table>
                <a href="/geo/download/?acc=GSE77286&amp;format=file">(http)</a>
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
  assert.ok(report.apiLinks.some((link) => link.includes("/geo/download/?acc=GSE77286")));
  assert.ok(report.artifactSignals.length > 0);
});

test("validateDatasetCandidate accepts OpenML datasets using provider metadata", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://www.openml.org/d/61",
      description: "OpenML iris benchmark.",
      providerSlug: "openml",
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/api/v1/json/data/61")) {
          return new Response(
            JSON.stringify({
              data_set_description: {
                visibility: "public",
                status: "active",
                licence: "Public",
                format: "ARFF",
                url: "https://openml.org/data/v1/download/61/iris.arff",
                parquet_url: "https://data.openml.org/datasets/0000/0061/dataset_61.pq",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("<html><title>OpenML</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.equal(report.licenseStatus, "open");
  assert.ok(report.directFileLinks.some((link) => link.includes("iris.arff")));
});

test("validateDatasetCandidate accepts cBioPortal studies using provider metadata", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://www.cbioportal.org/study/summary?id=acc_tcga",
      description: "Public cBioPortal ACC study.",
      providerSlug: "cbioportal",
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/api/studies/acc_tcga")) {
          return new Response(
            JSON.stringify({
              name: "Adrenocortical Carcinoma (TCGA, Firehose Legacy)",
              groups: "PUBLIC",
              publicStudy: true,
              cnaSampleCount: 90,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("<html><title>cBioPortal for Cancer Genomics</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.ok(report.providerEvidence.some((entry) => entry.includes("publicStudy:true")));
});

test("validateDatasetCandidate accepts Hugging Face datasets with open licenses", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://huggingface.co/datasets/ibm-research/duorc",
      description: "Open reading comprehension dataset on Hugging Face.",
      providerSlug: "huggingface-datasets",
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/api/datasets/ibm-research/duorc")) {
          return new Response(
            JSON.stringify({
              gated: false,
              private: false,
              disabled: false,
              downloads: 1407,
              siblings: [{ rfilename: "README.md" }, { rfilename: "data/train.json" }],
              cardData: { license: ["mit"] },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("<html><title>Hugging Face</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.equal(report.license, "mit");
});

test("validateDatasetCandidate accepts Zenodo records with open files and licenses", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://zenodo.org/records/3723806",
      description: "Zenodo record with supplementary open files.",
      providerSlug: "zenodo",
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/api/records/3723806")) {
          return new Response(
            JSON.stringify({
              metadata: {
                access_right: "open",
                license: { id: "cc-by-4.0" },
              },
              files: [
                { links: { self: "https://zenodo.org/records/3723806/files/data.csv" } },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("<html><title>Zenodo</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.equal(report.license, "cc-by-4.0");
});

test("validateDatasetCandidate accepts figshare datasets with public files and licenses", async () => {
  const report = await validateDatasetCandidate(
    {
      url: "https://figshare.com/articles/dataset/example/32072493",
      description: "figshare dataset with CSV and notebook files.",
      providerSlug: "figshare",
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("/v2/articles/32072493")) {
          return new Response(
            JSON.stringify({
              is_public: true,
              license: { name: "MIT" },
              files: [
                { download_url: "https://ndownloader.figshare.com/files/63924210" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("<html><title>figshare</title></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      },
    },
  );

  assert.equal(report.status, "OPEN_USABLE");
  assert.equal(report.license, "MIT");
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
    artifactSignals: [],
    directFileLinks: [],
    githubDataLinks: [],
    apiLinks: [],
    accessSignals: [],
    notes: ["Claimed use: test dataset"],
  });

  assert.ok(lines.some((line) => line.includes("Validation status: OPEN_USABLE")));
  assert.ok(lines.some((line) => line.includes("Claimed use: test dataset")));
});
