import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { isUserFacingError } from "@/lib/errors";
import {
  createBundledPaper,
  listPapers,
  serializePaperDetail,
  serializePaperSummary,
} from "@/lib/platform";
import { paperBlobPayloadSchema } from "@/lib/paper-blob-payload";
import {
  collectManagedPaperBlobPathnamesFromUnknown,
  deleteManagedPaperBlobPathnames,
} from "@/lib/paper-storage-policy";
import { paperFormSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const papers = await listPapers({
    query: url.searchParams.get("q") ?? undefined,
    author: url.searchParams.get("author") ?? undefined,
    keyword: url.searchParams.get("keyword") ?? undefined,
    limit: url.searchParams.get("limit")
      ? Number(url.searchParams.get("limit"))
      : undefined,
  });

  return NextResponse.json({
    papers: papers.map(serializePaperSummary),
  });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);

  if (!user) {
    return unauthorizedJson();
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Paper publishing now expects JSON metadata with pre-uploaded blob files." },
      { status: 415 }
    );
  }

  const body = await request.json();
  const payload = paperFormSchema.safeParse({
    title: body.title,
    abstract: body.abstract,
    markdown: body.markdown,
    latexSource: body.latexSource,
    bibSource: body.bibSource,
    pdfUrl: body.pdfUrl,
    canonicalUrl: body.canonicalUrl,
    githubUrl: body.githubUrl,
    doi: body.doi,
    keywords: Array.isArray(body.keywords) ? body.keywords.join(", ") : (body.keywords ?? ""),
    references: Array.isArray(body.references)
      ? body.references.join("\n")
      : (body.references ?? ""),
    ideaNote: body.ideaNote,
  });

  if (!payload.success) {
    await deleteManagedPaperBlobPathnames(collectManagedPaperBlobPathnamesFromUnknown(body, user.id));
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid paper payload." },
      { status: 400 }
    );
  }

  const blobPayload = paperBlobPayloadSchema.safeParse(body);
  if (!blobPayload.success) {
    await deleteManagedPaperBlobPathnames(collectManagedPaperBlobPathnamesFromUnknown(body, user.id));
    return NextResponse.json(
      { error: blobPayload.error.issues[0]?.message ?? "Invalid uploaded file metadata." },
      { status: 400 }
    );
  }

  let paper;

  try {
    paper = await createBundledPaper(user.id, {
      ...payload.data,
      references: payload.data.references,
      pdf: blobPayload.data.pdf ?? null,
      figures: blobPayload.data.figures,
      artifacts: blobPayload.data.artifacts,
    });
  } catch (error) {
    await deleteManagedPaperBlobPathnames(collectManagedPaperBlobPathnamesFromUnknown(body, user.id));
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  return NextResponse.json({
    paper: serializePaperDetail(paper),
  });
}
