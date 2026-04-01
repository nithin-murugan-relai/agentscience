import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { getUniqueConstraintTargets, isUserFacingError } from "@/lib/errors";
import { getRankedPapers } from "@/lib/papers";
import { createBundledPaper } from "@/lib/platform";
import { buildPathWithNext, validateBrowserOrigin } from "@/lib/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseList, toSearchParams } from "@/lib/utils";
import { paperFormSchema } from "@/lib/validation";

async function toUploadDescriptor(file: File) {
  return {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: Buffer.from(await file.arrayBuffer()),
  };
}

export async function GET() {
  const papers = await getRankedPapers();
  return NextResponse.json(papers);
}

export async function POST(request: Request) {
  const invalidOrigin = validateBrowserOrigin(request);
  if (invalidOrigin) {
    return NextResponse.redirect(
      new URL(`/publish${toSearchParams({ error: invalidOrigin })}`, request.url),
      { status: 303 }
    );
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL(buildPathWithNext("/sign-in", "/publish"), request.url), {
      status: 303,
    });
  }

  const rateLimit = await checkRateLimit({
    namespace: "paper-create",
    key: user.id,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });

  if (!rateLimit.ok) {
    return NextResponse.redirect(
      new URL(
        `/publish${toSearchParams({
          error: "Too many publish attempts. Try again later.",
        })}`,
        request.url
      ),
      {
        status: 303,
        headers: {
          "Retry-After": `${Math.ceil(rateLimit.retryAfterMs / 1000)}`,
        },
      }
    );
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

  const pdfFile = formData.get("pdf");
  const figures = await Promise.all(
    formData
      .getAll("figures")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .map((entry) => toUploadDescriptor(entry))
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
      keywords:
        payload.data.keywords.length > 0
          ? payload.data.keywords
          : parseList(String(formData.get("keywords") ?? "")),
    });
  } catch (error) {
    if (isUserFacingError(error)) {
      return NextResponse.redirect(
        new URL(`/publish${toSearchParams({ error: error.message })}`, request.url),
        { status: 303 }
      );
    }

    const uniqueTargets = getUniqueConstraintTargets(error);
    if (uniqueTargets.includes("doi")) {
      return NextResponse.redirect(
        new URL(
          `/publish${toSearchParams({
            error: "A paper with that DOI already exists.",
          })}`,
          request.url
        ),
        { status: 303 }
      );
    }

    throw error;
  }

  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/publish");

  return NextResponse.redirect(new URL(`/papers/${paper?.slug}`, request.url), {
    status: 303,
  });
}
