import { NextResponse } from "next/server";

import { getApiUser, unauthorizedJson } from "@/lib/api-auth";
import { isUserFacingError } from "@/lib/errors";
import {
  createBundledPaper,
  listPapers,
  serializePaperDetail,
  serializePaperSummary,
  type UploadDescriptor,
} from "@/lib/platform";
import { parseList } from "@/lib/utils";
import { paperFormSchema } from "@/lib/validation";

function parseArrayField(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return parseList(trimmed);
  }
}

function toUploadDescriptor(file: File, caption?: string): Promise<UploadDescriptor> {
  return file.arrayBuffer().then((buffer) => ({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: Buffer.from(buffer),
    caption,
  }));
}

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
    title: formData.get("title"),
    abstract: formData.get("abstract"),
    markdown: formData.get("markdown"),
    latexSource: formData.get("latexSource"),
    bibSource: formData.get("bibSource"),
    pdfUrl: formData.get("pdfUrl"),
    canonicalUrl: formData.get("canonicalUrl"),
    githubUrl: formData.get("githubUrl"),
    doi: formData.get("doi"),
    keywords: (parseArrayField(formData.get("keywords")) ?? []).join(", "),
    references: (parseArrayField(formData.get("references")) ?? []).join("\n"),
    ideaNote: formData.get("ideaNote"),
  });

  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Invalid paper payload." },
      { status: 400 }
    );
  }

  const pdfFile = formData.get("pdf");
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
