import { PaperArtifactKind, PaperAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { zipSync } from "fflate";

import { getPaperDetail } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ slug: string; kind: string }>;
};

type ZipArtifactRecord = {
  kind: PaperArtifactKind;
  path: string;
  fileName: string;
  textContent: string | null;
  bytes: Uint8Array<ArrayBufferLike> | null;
};

type ZipAssetRecord = {
  id: string;
  kind: PaperAssetKind;
  fileName: string;
  textContent: string | null;
  bytes: Uint8Array<ArrayBufferLike> | null;
};

export type PaperZipSource = {
  slug: string;
  pdfData: Uint8Array<ArrayBufferLike> | null;
  pdfUrl: string | null;
  pdfFileName: string | null;
  latexSource: string | null;
  bibSource: string | null;
  artifacts: ZipArtifactRecord[];
  assets: ZipAssetRecord[];
};

type RemoteBytesFetcher = (url: string, label: string) => Promise<Uint8Array>;

const textEncoder = new TextEncoder();
const PRIMARY_ARTIFACT_KINDS: Set<string> = new Set([
  PaperArtifactKind.PDF,
  PaperArtifactKind.LATEX_SOURCE,
  PaperArtifactKind.BIBLIOGRAPHY,
]);

class DownloadBundleError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function toBytes(value: Uint8Array<ArrayBufferLike>) {
  return new Uint8Array(value);
}

function encodeText(value: string) {
  return textEncoder.encode(value);
}

function normalizeZipPath(value: string) {
  return value
    .split(/[\\/]+/)
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

function prefixedZipPath(prefix: string, value: string) {
  const normalizedPrefix = normalizeZipPath(prefix);
  const normalizedValue = normalizeZipPath(value);

  if (!normalizedValue) {
    return normalizedPrefix;
  }

  return normalizedValue.startsWith(`${normalizedPrefix}/`)
    ? normalizedValue
    : `${normalizedPrefix}/${normalizedValue}`;
}

function fileNameFromPath(value: string, fallback: string) {
  const normalized = normalizeZipPath(value);
  return normalized.split("/").at(-1) ?? fallback;
}

function isRemoteUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchRemoteBytes(url: string, label: string) {
  const response = await fetch(url, {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new DownloadBundleError(`Failed to fetch ${label}.`, 502);
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function buildPaperZipFiles(
  paper: PaperZipSource,
  fetchBytes: RemoteBytesFetcher = fetchRemoteBytes
) {
  const files: Record<string, Uint8Array> = {};
  const pdfArtifact = paper.artifacts.find((artifact) => artifact.kind === PaperArtifactKind.PDF);
  const latexArtifact = paper.artifacts.find(
    (artifact) => artifact.kind === PaperArtifactKind.LATEX_SOURCE
  );
  const bibArtifact = paper.artifacts.find(
    (artifact) => artifact.kind === PaperArtifactKind.BIBLIOGRAPHY
  );

  const addTextFile = (path: string, contents: string) => {
    files[normalizeZipPath(path)] = encodeText(contents);
  };

  const addBinaryFile = (path: string, contents: Uint8Array<ArrayBufferLike>) => {
    files[normalizeZipPath(path)] = toBytes(contents);
  };

  if (paper.pdfData) {
    addBinaryFile(paper.pdfFileName ?? `${paper.slug}.pdf`, paper.pdfData);
  } else if (pdfArtifact?.bytes) {
    addBinaryFile(pdfArtifact.path || pdfArtifact.fileName, pdfArtifact.bytes);
  } else if (paper.pdfUrl) {
    files[normalizeZipPath(paper.pdfFileName ?? `${paper.slug}.pdf`)] = await fetchBytes(
      paper.pdfUrl,
      "paper PDF"
    );
  }

  if (paper.latexSource) {
    addTextFile(latexArtifact?.path ?? "paper.tex", paper.latexSource);
  } else if (latexArtifact?.textContent != null) {
    addTextFile(latexArtifact.path || latexArtifact.fileName, latexArtifact.textContent);
  } else if (latexArtifact?.bytes) {
    addBinaryFile(latexArtifact.path || latexArtifact.fileName, latexArtifact.bytes);
  }

  if (paper.bibSource) {
    addTextFile(bibArtifact?.path ?? "references.bib", paper.bibSource);
  } else if (bibArtifact?.textContent != null) {
    addTextFile(bibArtifact.path || bibArtifact.fileName, bibArtifact.textContent);
  } else if (bibArtifact?.bytes) {
    addBinaryFile(bibArtifact.path || bibArtifact.fileName, bibArtifact.bytes);
  }

  for (const artifact of paper.artifacts) {
    if (PRIMARY_ARTIFACT_KINDS.has(artifact.kind)) {
      continue;
    }

    const artifactPath = prefixedZipPath("code", artifact.path || artifact.fileName);

    if (artifact.textContent != null) {
      addTextFile(artifactPath, artifact.textContent);
      continue;
    }

    if (artifact.bytes) {
      addBinaryFile(artifactPath, artifact.bytes);
      continue;
    }

    throw new DownloadBundleError(
      `Artifact contents unavailable for ${artifact.path}.`,
      404
    );
  }

  for (const asset of paper.assets) {
    if (asset.kind !== PaperAssetKind.FIGURE) {
      continue;
    }

    const assetPath = prefixedZipPath(
      "figures",
      fileNameFromPath(asset.fileName, `${asset.id}.bin`)
    );

    if (asset.bytes) {
      addBinaryFile(assetPath, asset.bytes);
      continue;
    }

    if (asset.textContent != null) {
      if (isRemoteUrl(asset.textContent)) {
        files[assetPath] = await fetchBytes(asset.textContent, `figure ${asset.fileName}`);
        continue;
      }

      addTextFile(assetPath, asset.textContent);
      continue;
    }

    throw new DownloadBundleError(
      `Figure contents unavailable for ${asset.fileName}.`,
      404
    );
  }

  if (Object.keys(files).length === 0) {
    throw new DownloadBundleError("Nothing to bundle.", 404);
  }

  return files;
}

export async function GET(_: Request, { params }: RouteProps) {
  const { slug, kind } = await params;
  const paper = await getPaperDetail(slug);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  if (kind === "pdf") {
    if (paper.pdfData) {
      return new NextResponse(paper.pdfData, {
        headers: {
          "Content-Type": paper.pdfMimeType ?? "application/pdf",
          "Content-Disposition": `inline; filename="${paper.pdfFileName ?? `${paper.slug}.pdf`}"`,
        },
      });
    }

    if (paper.pdfUrl) {
      return NextResponse.redirect(paper.pdfUrl, { status: 307 });
    }
  }

  if (kind === "latex" && paper.latexSource) {
    return new NextResponse(paper.latexSource, {
      headers: {
        "Content-Type": "application/x-latex; charset=utf-8",
        "Content-Disposition": `attachment; filename="${paper.slug}.tex"`,
      },
    });
  }

  if (kind === "bib" && paper.bibSource) {
    return new NextResponse(paper.bibSource, {
      headers: {
        "Content-Type": "application/x-bibtex; charset=utf-8",
        "Content-Disposition": `attachment; filename="${paper.slug}.bib"`,
      },
    });
  }

  if (kind === "zip") {
    try {
      const zipped = zipSync(await buildPaperZipFiles(paper));
      return new NextResponse(Buffer.from(zipped), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${paper.slug}.zip"`,
        },
      });
    } catch (error) {
      if (error instanceof DownloadBundleError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      throw error;
    }
  }

  return NextResponse.json({ error: "File not found." }, { status: 404 });
}
