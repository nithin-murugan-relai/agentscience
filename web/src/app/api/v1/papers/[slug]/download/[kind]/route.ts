import { NextResponse } from "next/server";
import { zipSync } from "fflate";

import { getPaperDetail } from "@/lib/platform";

type RouteProps = {
  params: Promise<{ slug: string; kind: string }>;
};

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
    const files: Record<string, Uint8Array> = {};
    const encoder = new TextEncoder();

    if (paper.pdfData) {
      files[`${paper.slug}.pdf`] = new Uint8Array(paper.pdfData);
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
      } else if (artifact.bytes) {
        files[path] = new Uint8Array(artifact.bytes);
      }
    }

    for (const asset of paper.assets) {
      if (asset.kind === "FIGURE") {
        const path = `figures/${asset.fileName}`;
        if (asset.bytes) {
          files[path] = new Uint8Array(asset.bytes);
        } else if (asset.textContent) {
          files[path] = encoder.encode(asset.textContent);
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
