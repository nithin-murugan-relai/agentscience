import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { isUserFacingError } from "@/lib/errors";
import {
  createBundledPaper,
  listPapers,
  serializePaperDetail,
  serializePaperSummary,
} from "@/lib/platform";
import {
  optionalStringField,
  parseArrayField,
  parseArtifactUploads,
  toUploadDescriptor,
} from "@/lib/paper-upload";
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

  const formData = await request.formData();
  const payload = paperFormSchema.safeParse({
    title: optionalStringField(formData.get("title")),
    abstract: optionalStringField(formData.get("abstract")),
    markdown: optionalStringField(formData.get("markdown")),
    latexSource: optionalStringField(formData.get("latexSource")),
    bibSource: optionalStringField(formData.get("bibSource")),
    pdfUrl: optionalStringField(formData.get("pdfUrl")),
    canonicalUrl: optionalStringField(formData.get("canonicalUrl")),
    githubUrl: optionalStringField(formData.get("githubUrl")),
    doi: optionalStringField(formData.get("doi")),
    keywords: (parseArrayField(formData.get("keywords")) ?? []).join(", "),
    references: (parseArrayField(formData.get("references")) ?? []).join("\n"),
    ideaNote: optionalStringField(formData.get("ideaNote")),
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid paper payload." },
      { status: 400 }
    );
  }

  const pdfFile = formData.get("pdf");
  let artifacts;

  try {
    artifacts = await parseArtifactUploads(formData);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid artifact bundle.",
      },
      { status: 400 }
    );
  }

  const figures = await Promise.all(
    formData
      .getAll("figures")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((figure, index) =>
        toUploadDescriptor(
          figure,
          typeof formData.getAll("figureCaptions")[index] === "string"
            ? String(formData.getAll("figureCaptions")[index])
            : undefined
        )
      )
  );

  let paper;

  try {
    paper = await createBundledPaper(user.id, {
      ...payload.data,
      references: payload.data.references,
      pdf:
        pdfFile instanceof File && pdfFile.size > 0
          ? await toUploadDescriptor(pdfFile)
          : null,
      figures,
      artifacts,
    });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  return NextResponse.json({
    paper: serializePaperDetail(paper),
  });
}
