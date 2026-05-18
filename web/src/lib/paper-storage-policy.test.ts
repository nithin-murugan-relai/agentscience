import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PAPER_ARTIFACT_BYTES,
  MAX_PAPER_FIGURE_BYTES,
  MAX_PAPER_TOTAL_ARTIFACT_BYTES,
  MAX_PAPER_TOTAL_FIGURE_BYTES,
  collectManagedPaperBlobPathnamesFromUnknown,
  getPaperUploadRole,
  getPaperUploadRoleLimitBytes,
  validatePaperBlobBudget,
} from "@/lib/paper-storage-policy";

const blobBase = {
  url: "https://blob.example.test/file",
  pathname: "papers/staged/user/upload/artifacts/file.txt",
  downloadUrl: "https://blob.example.test/file?download=1",
};

function artifact(sizeBytes: number, path = "data.csv") {
  return {
    ...blobBase,
    path,
    contentType: "text/csv",
    sizeBytes,
    sha256: "a".repeat(64),
  };
}

function figure(sizeBytes: number, fileName = "figure.png") {
  return {
    ...blobBase,
    pathname: `papers/staged/user/upload/figures/${fileName}`,
    fileName,
    mimeType: "image/png",
    sizeBytes,
  };
}

test("paper blob policy maps staged path roles to upload caps", () => {
  assert.equal(getPaperUploadRole("papers/staged/user/upload/pdf/paper.pdf"), "pdf");
  assert.equal(getPaperUploadRole("papers/staged/user/upload/artifacts/results.csv"), "artifacts");
  assert.equal(getPaperUploadRole("papers/staged/user/upload/figures/plot.png"), "figures");
  assert.equal(getPaperUploadRole("papers/staged/user/upload/other/file.bin"), null);
  assert.equal(getPaperUploadRoleLimitBytes("artifacts"), MAX_PAPER_ARTIFACT_BYTES);
});

test("paper blob policy rejects oversized and over-budget supplemental artifacts", () => {
  assert.match(
    validatePaperBlobBudget({
      pdf: null,
      figures: [],
      artifacts: [artifact(MAX_PAPER_ARTIFACT_BYTES + 1)],
    }) ?? "",
    /Supplemental artifacts are limited/
  );

  assert.match(
    validatePaperBlobBudget({
      pdf: null,
      figures: [],
      artifacts: [
        artifact(MAX_PAPER_ARTIFACT_BYTES, "bulk-01.csv"),
        artifact(MAX_PAPER_ARTIFACT_BYTES, "bulk-02.csv"),
        artifact(MAX_PAPER_ARTIFACT_BYTES, "bulk-03.csv"),
        artifact(MAX_PAPER_ARTIFACT_BYTES, "bulk-04.csv"),
        artifact(MAX_PAPER_ARTIFACT_BYTES, "bulk-05.csv"),
        artifact(1, "bulk-06.csv"),
      ],
    }) ?? "",
    new RegExp(`${Math.round(MAX_PAPER_TOTAL_ARTIFACT_BYTES / 1024 / 1024)} MB total`)
  );
});

test("paper blob policy rejects oversized and over-budget figures", () => {
  assert.match(
    validatePaperBlobBudget({
      pdf: null,
      figures: [figure(MAX_PAPER_FIGURE_BYTES + 1)],
      artifacts: [],
    }) ?? "",
    /Figure uploads are limited/
  );

  assert.match(
    validatePaperBlobBudget({
      pdf: null,
      figures: [
        figure(MAX_PAPER_FIGURE_BYTES, "figure-1.png"),
        figure(MAX_PAPER_FIGURE_BYTES, "figure-2.png"),
        figure(MAX_PAPER_FIGURE_BYTES, "figure-3.png"),
        figure(MAX_PAPER_FIGURE_BYTES, "figure-4.png"),
      ],
      artifacts: [],
    }) ?? "",
    new RegExp(`${Math.round(MAX_PAPER_TOTAL_FIGURE_BYTES / 1024 / 1024)} MB total`)
  );
});

test("paper blob policy collects only managed staged pathnames from raw payloads", () => {
  assert.deepEqual(
    collectManagedPaperBlobPathnamesFromUnknown({
      pdf: { pathname: "papers/staged/user/upload/pdf/paper.pdf" },
      figures: [{ pathname: "papers/staged/user/upload/figures/figure.png" }],
      artifacts: [
        { pathname: "papers/staged/user/upload/artifacts/results.csv" },
        { pathname: "external/path/that/is/not/managed.csv" },
      ],
    }).sort(),
    [
      "papers/staged/user/upload/artifacts/results.csv",
      "papers/staged/user/upload/figures/figure.png",
      "papers/staged/user/upload/pdf/paper.pdf",
    ]
  );
});

test("paper blob policy scopes rejected-upload cleanup to the authenticated user", () => {
  assert.deepEqual(
    collectManagedPaperBlobPathnamesFromUnknown(
      {
        pdf: { pathname: "papers/staged/user/upload/pdf/paper.pdf" },
        figures: [{ pathname: "papers/staged/other-user/upload/figures/figure.png" }],
        artifacts: [{ pathname: "papers/staged/user/upload/artifacts/results.csv" }],
      },
      "user"
    ).sort(),
    [
      "papers/staged/user/upload/artifacts/results.csv",
      "papers/staged/user/upload/pdf/paper.pdf",
    ]
  );
});
