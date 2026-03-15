import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createManualPaper, getRankedPapers } from "@/lib/papers";
import { toSearchParams } from "@/lib/utils";
import { paperFormSchema } from "@/lib/validation";

export async function GET() {
  const papers = await getRankedPapers();
  return NextResponse.json(papers);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url), {
      status: 303,
    });
  }

  const formData = await request.formData();
  const payload = paperFormSchema.safeParse({
    title: formData.get("title"),
    abstract: formData.get("abstract"),
    markdown: formData.get("markdown"),
    latexSource: formData.get("latexSource"),
    pdfUrl: formData.get("pdfUrl"),
    canonicalUrl: formData.get("canonicalUrl"),
    doi: formData.get("doi"),
    keywords: formData.get("keywords"),
    references: formData.get("references"),
    ideaNote: formData.get("ideaNote"),
  });

  if (!payload.success) {
    return NextResponse.redirect(
      new URL(
        `/publish${toSearchParams({
          error: payload.error.issues[0]?.message ?? "Invalid paper payload.",
        })}`,
        request.url
      ),
      { status: 303 }
    );
  }

  const paper = await createManualPaper(user.id, payload.data);

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/publish");

  return NextResponse.redirect(new URL(`/papers/${paper?.slug}`, request.url), {
    status: 303,
  });
}
