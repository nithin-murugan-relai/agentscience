type PaperBundleArtifactRecord = {
  id: string;
  kind: string;
  path: string;
  fileName: string;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  textContent: string | null;
};

type PaperBundleFigureRecord = {
  id: string;
  kind: string;
  fileName: string;
  caption: string | null;
  mimeType: string;
};

type PaperBundleRecord = {
  slug: string;
  artifacts: PaperBundleArtifactRecord[];
  assets: PaperBundleFigureRecord[];
  pdfData: Uint8Array<ArrayBufferLike> | null;
  pdfUrl: string | null;
};

export type PaperBundleTab = "code" | "figures" | "pdf";

export type PaperBundleArtifactView = {
  id: string;
  kind: string;
  path: string;
  fileName: string;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  downloadUrl: string;
  isText: boolean;
  textContent: string | null;
};

export type PaperBundleFigureView = {
  id: string;
  kind: string;
  fileName: string;
  caption: string | null;
  downloadUrl: string;
  mimeType: string;
};

export type PaperBundleView = {
  artifacts: PaperBundleArtifactView[];
  figures: PaperBundleFigureView[];
  pdfUrl: string | null;
  hasBundle: boolean;
};

function getPaperPdfDownloadUrl(paperSlug: string, hasPdf: boolean) {
  return hasPdf ? `/api/v1/papers/${paperSlug}/download/pdf` : null;
}

function serializePaperArtifact(
  paperSlug: string,
  artifact: PaperBundleArtifactRecord,
  includeTextContent: boolean
): PaperBundleArtifactView {
  return {
    id: artifact.id,
    kind: artifact.kind,
    path: artifact.path,
    fileName: artifact.fileName,
    contentType: artifact.contentType,
    sha256: artifact.sha256,
    sizeBytes: artifact.sizeBytes,
    downloadUrl: `/api/v1/papers/${paperSlug}/download/artifact/${artifact.id}`,
    isText: artifact.textContent != null,
    textContent: includeTextContent ? artifact.textContent : null,
  };
}

function serializePaperFigure(
  paperSlug: string,
  asset: PaperBundleFigureRecord
): PaperBundleFigureView {
  return {
    id: asset.id,
    kind: asset.kind,
    fileName: asset.fileName,
    caption: asset.caption ?? null,
    downloadUrl: `/api/v1/papers/${paperSlug}/download/asset/${asset.id}`,
    mimeType: asset.mimeType,
  };
}

export function buildPaperBundleView(
  paper: PaperBundleRecord,
  options: { includeTextContent?: boolean } = {}
): PaperBundleView {
  const includeTextContent = options.includeTextContent ?? false;
  const figures = paper.assets
    .filter((asset) => asset.kind === "FIGURE")
    .map((asset) => serializePaperFigure(paper.slug, asset));
  const artifacts = paper.artifacts.map((artifact) =>
    serializePaperArtifact(paper.slug, artifact, includeTextContent)
  );
  const pdfUrl = getPaperPdfDownloadUrl(paper.slug, Boolean(paper.pdfData || paper.pdfUrl));

  return {
    artifacts,
    figures,
    pdfUrl,
    hasBundle: artifacts.length > 0 || figures.length > 0 || Boolean(pdfUrl),
  };
}

export function resolveInitialPaperBundleTab(
  bundle: PaperBundleView,
  requestedTab?: string
): PaperBundleTab {
  if (requestedTab === "code" || requestedTab === "figures" || requestedTab === "pdf") {
    return requestedTab;
  }

  if (bundle.artifacts.length > 0) {
    return "code";
  }

  if (bundle.pdfUrl) {
    return "pdf";
  }

  return "figures";
}
