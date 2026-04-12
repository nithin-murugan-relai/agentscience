import assert from "node:assert/strict";
import test from "node:test";

import { PaperArtifactKind, PaperAssetKind } from "@prisma/client";
import { strFromU8 } from "fflate";

import { buildPaperZipFiles } from "@/app/api/v1/papers/[slug]/download/[kind]/route";

test("buildPaperZipFiles bundles stored bytes and text into the expected archive layout", async () => {
  const pdfBytes = Buffer.from("%PDF-1.7\nzip bundle test\n", "utf8");
  const figureBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  const binaryArtifact = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

  const files = await buildPaperZipFiles({
    slug: "zip-bundle-coverage",
    pdfData: pdfBytes,
    pdfUrl: null,
    pdfFileName: "zip-bundle.pdf",
    latexSource: "\\documentclass{article}\n\\begin{document}\nZIP coverage.\n\\end{document}\n",
    bibSource: "@article{zip-coverage,title={ZIP coverage}}\n",
    artifacts: [
      {
        kind: PaperArtifactKind.LATEX_SOURCE,
        path: "paper.tex",
        fileName: "paper.tex",
        textContent: "\\documentclass{article}\n\\begin{document}\nartifact copy\n\\end{document}\n",
        bytes: null,
      },
      {
        kind: PaperArtifactKind.BIBLIOGRAPHY,
        path: "references.bib",
        fileName: "references.bib",
        textContent: "@article{artifact-copy,title={Artifact copy}}\n",
        bytes: null,
      },
      {
        kind: PaperArtifactKind.PDF,
        path: "zip-bundle.pdf",
        fileName: "zip-bundle.pdf",
        textContent: null,
        bytes: pdfBytes,
      },
      {
        kind: PaperArtifactKind.ANALYSIS_CODE,
        path: "scripts/analyze.py",
        fileName: "analyze.py",
        textContent: "print('zip-ok')\n",
        bytes: null,
      },
      {
        kind: PaperArtifactKind.OTHER,
        path: "bin/model.bin",
        fileName: "model.bin",
        textContent: null,
        bytes: binaryArtifact,
      },
    ],
    assets: [
      {
        id: "figure-1",
        kind: PaperAssetKind.FIGURE,
        fileName: "figure-1.png",
        textContent: null,
        bytes: figureBytes,
      },
    ],
  });

  assert.equal(Buffer.from(files["zip-bundle.pdf"] ?? []).toString("utf8"), pdfBytes.toString("utf8"));
  assert.equal(
    strFromU8(files["paper.tex"] ?? new Uint8Array()),
    "\\documentclass{article}\n\\begin{document}\nZIP coverage.\n\\end{document}\n"
  );
  assert.equal(
    strFromU8(files["references.bib"] ?? new Uint8Array()),
    "@article{zip-coverage,title={ZIP coverage}}\n"
  );
  assert.equal(
    strFromU8(files["code/scripts/analyze.py"] ?? new Uint8Array()),
    "print('zip-ok')\n"
  );
  assert.deepEqual(Buffer.from(files["code/bin/model.bin"] ?? []), binaryArtifact);
  assert.deepEqual(Buffer.from(files["figures/figure-1.png"] ?? []), figureBytes);
  assert.equal("code/zip-bundle.pdf" in files, false);
});

test("buildPaperZipFiles fetches remote PDF and figure URLs when bytes are missing", async () => {
  const remotePdfBytes = Buffer.from("%PDF-1.7\nremote zip bundle\n", "utf8");
  const remoteFigureBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const requestedUrls: string[] = [];

  const files = await buildPaperZipFiles(
    {
      slug: "remote-zip-bundle",
      pdfData: null,
      pdfUrl: "https://assets.example.com/papers/remote-paper.pdf",
      pdfFileName: "remote-paper.pdf",
      latexSource: "\\documentclass{article}\n\\begin{document}\nRemote ZIP.\n\\end{document}\n",
      bibSource: "@article{remote-zip,title={Remote ZIP}}\n",
      artifacts: [
        {
          kind: PaperArtifactKind.ANALYSIS_CODE,
          path: "scripts/remote.py",
          fileName: "remote.py",
          textContent: "print('remote-zip')\n",
          bytes: null,
        },
      ],
      assets: [
        {
          id: "figure-1",
          kind: PaperAssetKind.FIGURE,
          fileName: "figure-1.png",
          textContent: "https://assets.example.com/papers/figure-1.png",
          bytes: null,
        },
      ],
    },
    async (url) => {
      requestedUrls.push(url);

      if (url === "https://assets.example.com/papers/remote-paper.pdf") {
        return new Uint8Array(remotePdfBytes);
      }

      if (url === "https://assets.example.com/papers/figure-1.png") {
        return new Uint8Array(remoteFigureBytes);
      }

      throw new Error(`Unexpected URL: ${url}`);
    }
  );

  assert.deepEqual(requestedUrls.sort(), [
    "https://assets.example.com/papers/figure-1.png",
    "https://assets.example.com/papers/remote-paper.pdf",
  ]);
  assert.equal(
    Buffer.from(files["remote-paper.pdf"] ?? []).toString("utf8"),
    remotePdfBytes.toString("utf8")
  );
  assert.equal(
    strFromU8(files["code/scripts/remote.py"] ?? new Uint8Array()),
    "print('remote-zip')\n"
  );
  assert.deepEqual(Buffer.from(files["figures/figure-1.png"] ?? []), remoteFigureBytes);
});
