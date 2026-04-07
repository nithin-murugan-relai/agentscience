import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { UserFacingError } from "@/lib/errors";
import {
  deletePaper,
  getPaperDetail,
  serializePaperDetail,
  updatePaper,
} from "@/lib/platform";
import { parseArtifactUploads } from "@/lib/paper-upload";

type RouteProps = {
  params: Promise<{ slug: string }>;
};

export async function GET(_: Request, { params }: RouteProps) {
  const { slug } = await params;
  const paper = await getPaperDetail(slug);

  if (!paper) {
    return NextResponse.json({ error: "Paper not found." }, { status: 404 });
  }

  return NextResponse.json({
    paper: serializePaperDetail(paper),
  });
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const user = await getApiUser(request);
  if (!user) {
    return unauthorizedJson();
  }

  const { slug } = await params;

  try {
    await deletePaper(slug, user.id);
    return NextResponse.json({ ok: true, slug });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const user = await getApiUser(request);
  if (!user) {
    return unauthorizedJson();
  }

  const { slug } = await params;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let title: string | undefined;
    let abstract: string | undefined;
    let latexSource: string | undefined;
    let bibSource: string | undefined;
    let keywords: string[] | undefined;
    let pdf: { fileName: string; mimeType: string; bytes: Buffer } | null = null;
    let artifacts;

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      if (form.has("title")) title = form.get("title") as string;
      if (form.has("abstract")) abstract = form.get("abstract") as string;
      if (form.has("latexSource")) latexSource = form.get("latexSource") as string;
      if (form.has("bibSource")) bibSource = form.get("bibSource") as string;
      if (form.has("keywords")) {
        keywords = JSON.parse(form.get("keywords") as string);
      }
      const pdfFile = form.get("pdf") as File | null;
      if (pdfFile) {
        pdf = {
          fileName: pdfFile.name,
          mimeType: pdfFile.type || "application/pdf",
          bytes: Buffer.from(await pdfFile.arrayBuffer()),
        };
      }
      artifacts = await parseArtifactUploads(form);
    } else {
      const body = await request.json();
      title = body.title;
      abstract = body.abstract;
      latexSource = body.latexSource;
      bibSource = body.bibSource;
      keywords = body.keywords;
      artifacts = body.artifacts;
    }

    const detail = await updatePaper(slug, user.id, {
      title,
      abstract,
      latexSource,
      bibSource,
      keywords,
      pdf,
      artifacts,
    });

    return NextResponse.json({ paper: serializePaperDetail(detail) });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
