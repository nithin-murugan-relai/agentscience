import { NextResponse } from "next/server";
import { zipSync } from "fflate";

import { getPaperDetail } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ slug: string; kind: string }>;
};

async function fetchBlobBytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Blob fetch failed with status ${response.status}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function GET(request: Request, { params }: RouteProps) {
  const { slug, kind } = await params;
  const paper = await getPaperDetail(slug);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  if (kind === "pdf") {
    if (paper.pdfStorageUrl) {
      const forceDownload = new URL(request.url).searchParams.get("download") === "1";
      return NextResponse.redirect(
        forceDownload ? paper.pdfDownloadUrl ?? paper.pdfStorageUrl : paper.pdfStorageUrl,
        { status: 307 }
      );
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
    const totalBlobBytes =
      (paper.pdfSizeBytes ?? 0) +
      paper.artifacts.reduce((sum, artifact) => sum + artifact.sizeBytes, 0) +
      paper.assets.reduce((sum, asset) => sum + (asset.sizeBytes ?? 0), 0);

    if (totalBlobBytes > 4 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            "This bundle is too large to zip through the API. Download individual files instead.",
        },
        { status: 413 }
      );
    }

    const files: Record<string, Uint8Array> = {};
    const encoder = new TextEncoder();

    if (paper.pdfStorageUrl) {
      files[`${paper.slug}.pdf`] = await fetchBlobBytes(paper.pdfStorageUrl);
    }
    if (paper.latexSource) {
      files[`${paper.slug}.tex`] = encoder.encode(paper.latexSource);
    }
    if (paper.bibSource) {
      files[`${paper.slug}.bib`] = encoder.encode(paper.bibSource);
    }

    for (const artifact of paper.artifacts) {
      const path = `code/${artifact.path}`;
      if (artifact.textContent) {
        files[path] = encoder.encode(artifact.textContent);
      } else {
        files[path] = await fetchBlobBytes(artifact.blobUrl);
      }
    }

    for (const asset of paper.assets) {
      if (asset.kind === "FIGURE") {
        const path = `figures/${asset.fileName}`;
        if (asset.textContent) {
          files[path] = encoder.encode(asset.textContent);
        } else {
          files[path] = await fetchBlobBytes(asset.blobUrl);
        }
      }
    }

    if (Object.keys(files).length === 0) {
      return NextResponse.json({ error: "Nothing to bundle." }, { status: 404 });
    }

    const zipped = zipSync(files);
    return new NextResponse(Buffer.from(zipped), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${paper.slug}.zip"`,
      },
    });
  }

  return NextResponse.json({ error: "File not found." }, { status: 404 });
}
