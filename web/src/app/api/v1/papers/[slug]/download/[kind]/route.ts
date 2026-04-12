import { NextResponse } from "next/server";

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

  return NextResponse.json({ error: "File not found." }, { status: 404 });
}
