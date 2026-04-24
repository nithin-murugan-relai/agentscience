import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { UserFacingError } from "@/lib/errors";
import {
  deletePaper,
  getPaperDetail,
  serializePaperDetail,
  updatePaper,
} from "@/lib/platform";
import { paperBlobPayloadSchema } from "@/lib/paper-blob-payload";

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
    let markdown: string | undefined;
    let latexSource: string | undefined;
    let bibSource: string | undefined;
    let keywords: string[] | undefined;
    let pdf;
    let artifacts;

    if (contentType.includes("multipart/form-data")) {
      throw new UserFacingError(
        "Paper updates now expect JSON metadata with pre-uploaded blob files.",
        415
      );
    } else {
      const body = await request.json();
      title = body.title;
      abstract = body.abstract;
      markdown = body.markdown;
      latexSource = body.latexSource;
      bibSource = body.bibSource;
      keywords = body.keywords;
      const blobPayload = paperBlobPayloadSchema.partial().safeParse(body);
      if (!blobPayload.success) {
        throw new UserFacingError(
          blobPayload.error.issues[0]?.message ?? "Invalid uploaded file metadata.",
          400
        );
      }
      pdf = blobPayload.data.pdf ?? null;
      artifacts = blobPayload.data.artifacts;
    }

    const detail = await updatePaper(slug, user.id, {
      title,
      abstract,
      markdown,
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
